import { BearerStrategy, IBearerStrategyOptionWithRequest, ITokenPayload } from 'passport-azure-ad';

export const azureAdConfig: IBearerStrategyOptionWithRequest = {
  identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/v2.0/.well-known/openid-configuration`,
  clientID: process.env.AZURE_AD_CLIENT_ID || 'dummy-client-id',
  validateIssuer: true,
  issuer: process.env.AZURE_AD_TENANT_ID ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0` : undefined,
  passReqToCallback: true,
  loggingLevel: 'error',
  loggingNoPII: false,
  allowMultiAudiencesInToken: false,
  audience: process.env.AZURE_AD_CLIENT_ID || 'dummy-client-id',
  clockSkew: 300,
};

export const createBearerStrategy = () => {
  return new BearerStrategy(
    azureAdConfig,
    (_req: any, token: ITokenPayload, done: any) => {
      // Token is valid, pass the token payload
      return done(null, token, token);
    }
  );
};