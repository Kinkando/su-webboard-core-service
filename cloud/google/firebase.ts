import { FirebaseCredentialConfiguration } from "../../config/config";
import * as admin from 'firebase-admin';

export function newFirebaseAppWithServiceAccount(credential: FirebaseCredentialConfiguration) {
    const firebase = admin.initializeApp({
        credential: admin.credential.cert(credential as admin.ServiceAccount),
    });
    return firebase
}