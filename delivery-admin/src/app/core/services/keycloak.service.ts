import { Injectable } from '@angular/core';
import Keycloak from 'keycloak-js';

const url = 'http://localhost:9090';
const realm = 'delivery-admin';
const clientId = 'delivery-admin-ui';

@Injectable({ providedIn: 'root' })
export class KeycloakService {
  private keycloak = new Keycloak({ url, realm, clientId });

  init(): Promise<boolean> {
    return this.keycloak
      .init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri:
          window.location.origin + '/silent-check-sso.html',
      })
      .catch(() => {
        this.login();
        return false;
      });
  }

  isAuthenticated(): boolean {
    return !!this.keycloak.authenticated;
  }

  async getToken(): Promise<string | null> {
    if (!this.isAuthenticated()) {
      return null;
    }
    await this.keycloak.updateToken(30);
    return this.keycloak.token ?? null;
  }

  login(): Promise<void> {
    return this.keycloak.login();
  }

  logout(): Promise<void> {
    return this.keycloak.logout({ redirectUri: 'http://localhost:4200' });
  }
}
