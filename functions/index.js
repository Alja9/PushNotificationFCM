'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendFNotification = functions.database.ref('/notifications/{notificationId}')
  .onWrite((change, context) => {
    const snapshot = change.after;
    const val = snapshot.val();
    // Exit if data already created
    if (change.before.val()) {
      return null;
    }

    // Exit when the data is deleted
    if (!change.after.val()) {
      return null;
    }
    const payload = {
      notification: {
        title: `Pesan baru dari ${val.user}!`,
        body: val.message,
        icon: val.userProfilImg,
        click_action: `https://www.google.com/`
      }
    }
    console.info(payload);

    // Clean invalid tokens
    function cleanInvalidTokens(tokensWithKey, results) {
      const invalidTokens = [];
      results.forEach((result, i) => {
        if (!result.error) return;
        console.error('Failure sending notification to', tokensWithKey[i].token, result.error);
        switch (result.error.code) {
          case "messaging/invalid-registration-token":
          case "messaging/registration-token-not-registered":
            console.log(result.error.code);
            invalidTokens.push(admin.database().ref('/tokens').child(tokensWithKey[i].key).remove());
            break;
          default:
            break;
        }
      });
      return Promise.all(invalidTokens);
    }


    return admin.database().ref('/tokens').once('value').then((data) => {
      if (!data.val()) return;
      const snapshot = data.val();
      const tokensWithKey = [];
      const tokens = [];
      for (let key in snapshot) {
        tokens.push(snapshot[key].token);
        tokensWithKey.push({
          token: snapshot[key].token,
          key: key
        });
      }
      return admin.messaging().sendToDevice(tokens, payload)
        .then((response) => cleanInvalidTokens(tokensWithKey, response.results))
        .then(() => admin.database().ref('/notifications').child(`${val.key}`).remove())
    });
  });
