// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getDatabase, get, ref } from 'firebase/database'
// import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.VUE_APP_FDB_API_KEY,
  authDomain: process.env.VUE_APP_FDB_AUTH_DOMAIN,
  databaseURL: process.env.VUE_APP_FDB_DATABASE_URL,
  projectId: process.env.VUE_APP_FDB_PROJECT_ID,
  storageBucket: process.env.VUE_APP_FDB_STORAGE_BUCKET,
  messagingSenderId: process.env.VUE_APP_FDB_MESSAGING_SENDER_ID,
  appId: process.env.VUE_APP_FDB_APP_ID,
  measurementId: process.env.VUE_APP_FDB_MEASUREMENT_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
// const auth = getAuth(app)
const fdb = getDatabase(app)

class Database {
  constructor(fdb) {
    this.fdb = fdb
    this.rune = ref(fdb, '/rune/')
    this.scroll = ref(fdb, '/scroll/')
    this.searchTable = ref(fdb, '/equip_search/')
  }

  getItem = itemID => {
    return ref(this.fdb, `/equip_detail/${itemID}`)
  }

  query = async function (node) {
    const snapshot = await get(ref(this.fdb, node))
    const res = await snapshot.val()
    return res
  }
}

const mstDB = new Database(fdb)

export { mstDB, fdb }
