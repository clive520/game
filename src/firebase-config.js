// Public Firebase Web configuration for the dedicated Three Kingdoms app.
export const firebaseConfig = Object.freeze({"apiKey":"AIzaSyAY5exzunPHfeQBuBTcQMVObcF6A4UgqRU","authDomain":"ot-exam-review.firebaseapp.com","databaseURL":"https://three-kingdoms-ot-exam-review.asia-southeast1.firebasedatabase.app","projectId":"ot-exam-review","appId":"1:847450399951:web:9787f6210406221f4083ba"});

export const firebaseFunctionRegion = 'asia-southeast1';
export const firebaseDatabaseInstance = 'three-kingdoms-ot-exam-review';
export const firebaseAppCheckSiteKey = '6LdIDiMuAAAAAPTwI2-m-Z2TiWi9QIlL084YMlhf';

export function isFirebaseConfigured() {
  return !Object.values(firebaseConfig).some((value) => value.startsWith('REPLACE_WITH'))
    && !firebaseAppCheckSiteKey.startsWith('REPLACE_WITH');
}
