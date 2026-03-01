const GameSave = require("../models/GameSave");
const User = require("../models/User");
const faker = require("@faker-js/faker").fakerEN_US;
require("dotenv").config();

const testUserPassword = faker.internet.password({ length: 14 });

const makeSaveDoc = (ownerId) => ({
  owner: ownerId,
  title: `${faker.word.words(2)} ${faker.number.int({ min: 1, max: 99 })}`,
  mapId: "USA",
  turn: faker.number.int({ min: 1, max: 200 }),
  isFinished: faker.datatype.boolean(),
  tags: [faker.word.adjective(), faker.word.noun()],
  eventDates: [faker.date.recent()],
  payload: {
    version: 1,
    savedAt: Date.now(),
    gameSetup: {
      province: { id: "WA", name_en: "Washington", popPoints: 7700000 },
      warlordType: "economic",
      warlordCount: 6,
      playerColor: "#50c878",
    },
    engineSave: {
      turn: faker.number.int({ min: 1, max: 200 }),
      resources: {
        population: faker.number.int({ min: 1000, max: 100000 }),
        food: faker.number.int({ min: 0, max: 20000 }),
      },
    },
  },
});

const seed_db = async () => {
  let testUser = null;
  try {
    await GameSave.deleteMany({});
    await User.deleteMany({});
    testUser = await User.create({
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      password: testUserPassword,
    });
    const docs = Array.from({ length: 20 }, () => makeSaveDoc(testUser._id));
    await GameSave.insertMany(docs);
  } catch (e) {
    console.log("database error");
    console.log(e.message);
    throw e;
  }
  return testUser;
};

module.exports = { testUserPassword, seed_db };
