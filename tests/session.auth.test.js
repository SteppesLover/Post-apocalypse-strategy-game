const mongoose = require("mongoose");
const { expect } = require("chai");
const chaiHttp = require("chai-http");

const connectDB = require("../db/connect");
const app = require("../app");
const { seed_db, testUserPassword } = require("../util/seed_db");

const httpRequest = chaiHttp.request;

describe("Session auth flow (JWT)", function () {
  this.timeout(10000);

  before(async () => {
    const mongoURL = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
    if (!mongoURL) throw new Error("MONGO_URI_TEST (or MONGO_URI) is not set");
    await connectDB(mongoURL);
  });

  beforeEach(async function () {
    this.user = await seed_db();
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it("should log the user on and return a JWT", async function () {
    const res = await httpRequest.execute(app).post("/sessions/logon").send({
      email: this.user.email,
      password: testUserPassword,
    });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("ok", true);
    expect(res.body).to.have.nested.property("user.email", this.user.email);
    expect(res.body.token).to.be.a("string").and.not.empty;
    this.jwt = res.body.token;
  });

  it("should get /me with a valid Bearer token after logon", async function () {
    const loginRes = await httpRequest.execute(app).post("/sessions/logon").send({
      email: this.user.email,
      password: testUserPassword,
    });
    const token = loginRes.body.token;

    const meRes = await httpRequest
      .execute(app)
      .get("/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).to.equal(200);
    expect(meRes.body).to.have.property("email", this.user.email);
    expect(meRes.body).to.have.property("id");
  });

  it("should return 401 on /me without auth", async () => {
    const res = await httpRequest.execute(app).get("/me");
    expect(res.status).to.equal(401);
  });

  it("should log off (JWT mode returns ok=true)", async () => {
    const res = await httpRequest.execute(app).post("/sessions/logoff").send({});
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("ok", true);
  });
});
