package org.progresspalbackend.progresspalbackend.config;

import com.nimbusds.jwt.SignedJWT;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.util.StringUtils;

public class HybridJwtDecoder implements JwtDecoder {

    private final JwtDecoder localJwtDecoder;
    private final JwtDecoder keycloakJwtDecoder;
    private final String keycloakIssuerUri;

    public HybridJwtDecoder(JwtDecoder localJwtDecoder,
                            JwtDecoder keycloakJwtDecoder,
                            String keycloakIssuerUri) {
        this.localJwtDecoder = localJwtDecoder;
        this.keycloakJwtDecoder = keycloakJwtDecoder;
        this.keycloakIssuerUri = keycloakIssuerUri;
    }

    @Override
    public Jwt decode(String token) throws JwtException {
        String issuer = extractIssuer(token);
        if (StringUtils.hasText(keycloakIssuerUri) && keycloakIssuerUri.equals(issuer)) {
            if (keycloakJwtDecoder == null) {
                throw new BadJwtException("Keycloak JWT support is not configured");
            }
            return keycloakJwtDecoder.decode(token);
        }
        return localJwtDecoder.decode(token);
    }

    private String extractIssuer(String token) {
        try {
            SignedJWT signedJwt = SignedJWT.parse(token);
            if (signedJwt.getJWTClaimsSet() == null) {
                return null;
            }
            return signedJwt.getJWTClaimsSet().getIssuer();
        } catch (Exception ex) {
            return null;
        }
    }
}
