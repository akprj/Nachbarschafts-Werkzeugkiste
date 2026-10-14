"use strict";

const { onRequest } = require("firebase-functions/v2/https");

exports.recoverUserAccount = onRequest((request, response) => {
  response.status(410).json({
    error: "Legacy ID recovery has been removed. Use Firebase Authentication password reset."
  });
});
