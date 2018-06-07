class PGCommand {
  constructor () {

  }

  validateParameters(params, expected) {
    expected.forEach((expected_param) => {
      if (params[`'${expected_param}'`] === undefined) {
        throw new Error("INVALID_PARAMETERS");
      }
    });
  }

  async run(params) {

  }
};