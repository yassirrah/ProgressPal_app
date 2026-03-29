package org.progresspalbackend.progresspalbackend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.progresspalbackend.progresspalbackend.dto.error.ErrorResponse;
import org.progresspalbackend.progresspalbackend.service.KeycloakUserLinkService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final ObjectMapper objectMapper;
    private final HeaderUserIdAuthenticationFilter headerUserIdAuthenticationFilter;
    private final KeycloakUserLinkService keycloakUserLinkService;
    private final String keycloakIssuerUri;

    public SecurityConfig(ObjectMapper objectMapper,
                          HeaderUserIdAuthenticationFilter headerUserIdAuthenticationFilter,
                          KeycloakUserLinkService keycloakUserLinkService,
                          @Value("${app.security.keycloak.issuer-uri:}") String keycloakIssuerUri) {
        this.objectMapper = objectMapper;
        this.headerUserIdAuthenticationFilter = headerUserIdAuthenticationFilter;
        this.keycloakUserLinkService = keycloakUserLinkService;
        this.keycloakIssuerUri = keycloakIssuerUri;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/ping").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/users").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users", "/api/users/search", "/api/users/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/*/profile").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/sessions").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/activity-types/*").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/activity-types/*").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()

                        .requestMatchers(HttpMethod.POST, "/api/sessions").authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/sessions/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/sessions/live").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/sessions/*/join-requests").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/sessions/*/join-requests/incoming").authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/sessions/*/join-requests/*").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/sessions/*/room").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/sessions/*/room/messages").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/sessions/*/room/messages").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/me/join-requests/outgoing").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/activity-types").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/activity-types").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/activity-types/*").authenticated()
                        .requestMatchers("/api/me/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/feed").authenticated()
                        .requestMatchers("/api/friends/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/users/*/sessions").authenticated()
                        .anyRequest().permitAll())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(this::convertJwtAuthentication))
                        .authenticationEntryPoint((request, response, ex) ->
                                writeError(response, request, HttpStatus.UNAUTHORIZED, "Unauthorized"))
                        .accessDeniedHandler((request, response, ex) ->
                                writeError(response, request, HttpStatus.FORBIDDEN, "Forbidden")))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authEx) ->
                                writeError(response, request, HttpStatus.UNAUTHORIZED, "Unauthorized"))
                        .accessDeniedHandler((request, response, deniedEx) ->
                                writeError(response, request, HttpStatus.FORBIDDEN, "Forbidden")));

        http.addFilterBefore(headerUserIdAuthenticationFilter, BearerTokenAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(@Value("${app.security.jwt.secret}") String jwtSecret,
                          @Value("${app.security.keycloak.issuer-uri:}") String keycloakIssuerUri,
                          @Value("${app.security.keycloak.jwk-set-uri:}") String keycloakJwkSetUri) {
        SecretKey key = new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        JwtDecoder localDecoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        JwtDecoder keycloakDecoder = buildKeycloakJwtDecoder(keycloakIssuerUri, keycloakJwkSetUri);
        return new HybridJwtDecoder(localDecoder, keycloakDecoder, keycloakIssuerUri);
    }

    @Bean
    JwtEncoder jwtEncoder(@Value("${app.security.jwt.secret}") String jwtSecret) {
        SecretKey key = new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        return new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(key));
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private JwtAuthenticationToken convertJwtAuthentication(Jwt jwt) {
        Jwt effectiveJwt = jwt;
        if (isKeycloakJwt(jwt)) {
            try {
                Map<String, Object> claims = new LinkedHashMap<>(jwt.getClaims());
                claims.put("user_id", keycloakUserLinkService.resolveLocalUserId(jwt).toString());
                effectiveJwt = new Jwt(
                        jwt.getTokenValue(),
                        jwt.getIssuedAt(),
                        jwt.getExpiresAt(),
                        jwt.getHeaders(),
                        claims
                );
            } catch (ResponseStatusException ex) {
                if (HttpStatus.UNAUTHORIZED.equals(ex.getStatusCode())) {
                    throw new InvalidBearerTokenException(ex.getReason(), ex);
                }
                throw ex;
            }
        }
        return new JwtAuthenticationToken(effectiveJwt, AuthorityUtils.NO_AUTHORITIES);
    }

    private boolean isKeycloakJwt(Jwt jwt) {
        return jwt.getIssuer() != null
                && StringUtils.hasText(keycloakIssuerUri)
                && keycloakIssuerUri.equals(jwt.getIssuer().toString());
    }

    private JwtDecoder buildKeycloakJwtDecoder(String issuerUri, String jwkSetUri) {
        if (!StringUtils.hasText(issuerUri)) {
            return null;
        }
        if (StringUtils.hasText(jwkSetUri)) {
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuerUri));
            return decoder;
        }
        return JwtDecoders.fromIssuerLocation(issuerUri);
    }

    private void writeError(HttpServletResponse response,
                            HttpServletRequest request,
                            HttpStatus status,
                            String message) throws java.io.IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        ErrorResponse body = new ErrorResponse(
                Instant.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI()
        );

        objectMapper.writeValue(response.getWriter(), body);
    }
}
