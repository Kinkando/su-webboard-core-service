import { FirebaseCredentialConfiguration } from "@config/config";
import * as admin from 'firebase-admin';

export function newFirebaseAppWithServiceAccount(config: FirebaseCredentialConfiguration) {
    const firebase = admin.initializeApp({
        credential: admin.credential.cert(config as admin.ServiceAccount),
    });
    return firebase
}