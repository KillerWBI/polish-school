const { randomUUID } = require('crypto');

const generateMeetLink = () => `https://meet.jit.si/lf-${randomUUID()}`;

module.exports = { generateMeetLink };
