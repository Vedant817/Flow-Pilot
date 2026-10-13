class MockModel {
  constructor(data = {}) {
    Object.assign(this, data);
    this._id = this._id || 'mock-id';
  }

  async save() {
    return this;
  }

  set(data) {
    Object.assign(this, data);
  }

  static findOne() {
    return { sort: jest.fn(async () => null) };
  }
}

module.exports = {
  Order: MockModel,
  Feedback: MockModel,
  Error: MockModel,
  Conversation: MockModel,
};
