const puppeteer = require("puppeteer");
const mongoose = require("mongoose");
const { expect } = require("chai");

const app = require("../app");
const connectDB = require("../db/connect");
const { seed_db, testUserPassword } = require("../util/seed_db");
const GameSave = require("../models/GameSave");

let browser = null;
let page = null;
let server = null;
let testUser = null;

const clickButtonByText = async (label) => {
  const clicked = await page.evaluate((text) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((b) => (b.textContent || "").trim() === text);
    if (!target) return false;
    target.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`Button not found: ${label}`);
};

describe("game-ui puppeteer test", function () {
  this.timeout(30000);

  before(async function () {
    const mongoURL = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
    if (!mongoURL) throw new Error("MONGO_URI_TEST (or MONGO_URI) is not set");

    await connectDB(mongoURL);
    testUser = await seed_db();

    server = app.listen(3000);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    page = await browser.newPage();
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  });

  after(async function () {
    this.timeout(10000);
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close();
  });

  describe("logon page test", function () {
    this.timeout(20000);

    it("should resolve login form fields", async () => {
      await page.waitForSelector('input[name="email"]');
      await page.waitForSelector('input[name="password"]');
      await page.waitForSelector('button[type="submit"]');
    });

    it("should submit logon and reach setup screen", async () => {
      await page.click('input[name="email"]', { clickCount: 3 });
      await page.type('input[name="email"]', testUser.email);
      await page.click('input[name="password"]', { clickCount: 3 });
      await page.type('input[name="password"]', testUserPassword);
      await page.click('button[type="submit"]');

      await page.waitForSelector("div.setup-hello", { timeout: 15000 });
      const helloText = await page.$eval("div.setup-hello", (el) => el.textContent || "");
      expect(helloText).to.include(testUser.email);
    });
  });

  describe("puppeteer save operations", function () {
    this.timeout(30000);

    it("test1: should open cloud saves and show 20 entries after refresh", async () => {
      await page.waitForSelector("div.setup-hello", { timeout: 15000 });
      await clickButtonByText("Refresh");
      await page.waitForSelector(".list .list-row", { timeout: 15000 });

      const count = await page.$$eval(".list .list-row", (rows) => rows.length);
      expect(count).to.equal(20);
    });

    it("test2: should edit first cloud save and update DB", async () => {
      const firstTitleBefore = await page.$eval(".list .list-row .list-title", (el) => el.textContent.trim());
      const newTitle = `Renamed Save ${Date.now()}`;

      page.once("dialog", async (dialog) => {
        await dialog.accept(newTitle);
      });

      await clickButtonByText("Edit");

      await page.waitForFunction(
        (expected) => {
          const el = document.querySelector(".list .list-row .list-title");
          return Boolean(el && el.textContent && el.textContent.trim() === expected);
        },
        { timeout: 10000 },
        newTitle
      );

      const dbLatest = await GameSave.findOne({ owner: testUser._id }).sort({ updatedAt: -1 }).lean();
      expect(dbLatest).to.not.equal(null);
      expect(dbLatest.title).to.equal(newTitle);
      expect(firstTitleBefore).to.not.equal(newTitle);
    });

    it("test3: should delete a cloud save and reduce count to 19", async () => {
      await clickButtonByText("Delete");

      await page.waitForFunction(
        () => document.querySelectorAll(".list .list-row").length === 19,
        { timeout: 10000 }
      );

      const uiCount = await page.$$eval(".list .list-row", (rows) => rows.length);
      expect(uiCount).to.equal(19);

      const dbCount = await GameSave.countDocuments({ owner: testUser._id });
      expect(dbCount).to.equal(19);
    });
  });
});
