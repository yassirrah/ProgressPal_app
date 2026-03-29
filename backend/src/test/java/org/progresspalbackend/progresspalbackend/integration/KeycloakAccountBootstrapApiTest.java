package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import okhttp3.mockwebserver.Dispatcher;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.IOException;
import java.time.Instant;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class KeycloakAccountBootstrapApiTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:13-alpine")
            .withDatabaseName("progresspal")
            .withUsername("progress")
            .withPassword("progress");

    private static final RSAKey RSA_JWK = generateRsaJwk();
    private static final MockWebServer KEYCLOAK_SERVER = startKeycloakServer();

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", db::getJdbcUrl);
        registry.add("spring.datasource.username", db::getUsername);
        registry.add("spring.datasource.password", db::getPassword);
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("app.security.keycloak.issuer-uri", KeycloakAccountBootstrapApiTest::issuerUri);
        registry.add("app.security.keycloak.jwk-set-uri", KeycloakAccountBootstrapApiTest::jwkSetUri);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void cleanDb() {
        userRepository.deleteAll();
    }

    @AfterAll
    static void shutdownServer() throws IOException {
        KEYCLOAK_SERVER.shutdown();
    }

    @Test
    void meAccount_keycloakToken_linksExistingUserByEmail() throws Exception {
        User existing = new User();
        existing.setUsername("native_user");
        existing.setEmail("native@test.com");
        existing.setPassword(passwordEncoder.encode("pw123"));
        existing.setProfileImage("https://img.example/keep.png");
        existing.setCreatedAt(Instant.now());
        existing = userRepository.save(existing);

        MvcResult result = mvc.perform(get("/api/me/account")
                        .header("Authorization", "Bearer " + keycloakToken(
                                "kc-subject-1",
                                "native@test.com",
                                true,
                                "keycloak_name",
                                "https://img.example/new.png"
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(existing.getId().toString()))
                .andExpect(jsonPath("$.username").value("native_user"))
                .andExpect(jsonPath("$.profileImage").value("https://img.example/keep.png"))
                .andReturn();

        JsonNode body = json.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("email").asText()).isEqualTo("native@test.com");

        User linked = userRepository.findById(existing.getId()).orElseThrow();
        assertThat(linked.getAuthProvider()).isEqualTo("KEYCLOAK");
        assertThat(linked.getAuthIssuer()).isEqualTo(issuerUri());
        assertThat(linked.getAuthSubject()).isEqualTo("kc-subject-1");
        assertThat(linked.getProfileImage()).isEqualTo("https://img.example/keep.png");
    }

    @Test
    void meAccount_keycloakToken_createsNewLocalUser() throws Exception {
        mvc.perform(get("/api/me/account")
                        .header("Authorization", "Bearer " + keycloakToken(
                                "kc-subject-2",
                                "fresh@test.com",
                                true,
                                "fresh_focus",
                                "https://img.example/fresh.png"
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("fresh_focus"))
                .andExpect(jsonPath("$.email").value("fresh@test.com"))
                .andExpect(jsonPath("$.profileImage").value("https://img.example/fresh.png"));

        User created = userRepository.findByAuthIssuerAndAuthSubject(issuerUri(), "kc-subject-2").orElseThrow();
        assertThat(created.getEmail()).isEqualTo("fresh@test.com");
        assertThat(created.getUsername()).isEqualTo("fresh_focus");
        assertThat(created.getPassword()).isNull();
    }

    @Test
    void meAccount_keycloakToken_usernameCollision_appendsSuffix() throws Exception {
        User existing = new User();
        existing.setUsername("focus");
        existing.setEmail("existing@test.com");
        existing.setPassword(passwordEncoder.encode("pw123"));
        existing.setCreatedAt(Instant.now());
        userRepository.save(existing);

        mvc.perform(get("/api/me/account")
                        .header("Authorization", "Bearer " + keycloakToken(
                                "kc-subject-3",
                                "another@test.com",
                                true,
                                "focus",
                                null
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("another@test.com"))
                .andExpect(jsonPath("$.username").value(org.hamcrest.Matchers.startsWith("focus-")));

        User created = userRepository.findByAuthIssuerAndAuthSubject(issuerUri(), "kc-subject-3").orElseThrow();
        assertThat(created.getUsername()).startsWith("focus-");
        assertThat(created.getUsername()).isNotEqualTo("focus");
    }

    @Test
    void meAccount_keycloakToken_withoutVerifiedEmail_returns401() throws Exception {
        mvc.perform(get("/api/me/account")
                        .header("Authorization", "Bearer " + keycloakToken(
                                "kc-subject-4",
                                "unverified@test.com",
                                false,
                                "unverified",
                                null
                        )))
                .andExpect(status().isUnauthorized());
    }

    private static RSAKey generateRsaJwk() {
        try {
            return new RSAKeyGenerator(2048)
                    .keyID("progresspal-test-key")
                    .generate();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    private static MockWebServer startKeycloakServer() {
        MockWebServer server = new MockWebServer();
        server.setDispatcher(new Dispatcher() {
            @Override
            public MockResponse dispatch(RecordedRequest request) {
                if ("/realms/progresspal/protocol/openid-connect/certs".equals(request.getPath())) {
                    return new MockResponse()
                            .setHeader("Content-Type", "application/json")
                            .setBody(new JWKSet(RSA_JWK.toPublicJWK()).toString());
                }
                return new MockResponse().setResponseCode(404);
            }
        });
        try {
            server.start();
            return server;
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }

    private static String issuerUri() {
        return KEYCLOAK_SERVER.url("/realms/progresspal").toString();
    }

    private static String jwkSetUri() {
        return KEYCLOAK_SERVER.url("/realms/progresspal/protocol/openid-connect/certs").toString();
    }

    private String keycloakToken(String subject,
                                 String email,
                                 boolean emailVerified,
                                 String preferredUsername,
                                 String picture) throws Exception {
        Instant issuedAt = Instant.now();
        JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
                .issuer(issuerUri())
                .subject(subject)
                .issueTime(Date.from(issuedAt))
                .expirationTime(Date.from(issuedAt.plusSeconds(3600)))
                .claim("email", email)
                .claim("email_verified", emailVerified);

        if (preferredUsername != null) {
            claims.claim("preferred_username", preferredUsername);
        }
        if (picture != null) {
            claims.claim("picture", picture);
        }

        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256)
                        .type(JOSEObjectType.JWT)
                        .keyID(RSA_JWK.getKeyID())
                        .build(),
                claims.build()
        );
        jwt.sign(new RSASSASigner(RSA_JWK.toPrivateKey()));
        return jwt.serialize();
    }
}
