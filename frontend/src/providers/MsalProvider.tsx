'use client';

import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider as MsalReactProvider } from '@azure/msal-react';
import { msalConfig } from '../config/authConfig';
import { ReactNode } from 'react';

const msalInstance = new PublicClientApplication(msalConfig);

export function MsalProvider({ children }: { children: ReactNode }) {
  return (
    <MsalReactProvider instance={msalInstance}>
      {children}
    </MsalReactProvider>
  );
}