const collectionStub = () => ({
  findOne: async () => null,
  updateOne: async () => ({}),
  insertOne: async () => ({}),
  find: () => ({ toArray: async () => [] }),
});
module.exports = async () => ({ connection: { db: { collection: collectionStub } } });
module.exports.default = module.exports;
module.exports.dbConnect = module.exports;
