package org.progresspalbackend.progresspalbackend.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;

class KeycloakRealmImportContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void checkedInRealmImport_supportsHostedRegistrationAndPublicPkceClient() throws Exception {
        JsonNode realm = objectMapper.readTree(Files.readString(Path.of("keycloak/import/progresspal-realm.json")));

        assertThat(realm.path("realm").asText()).isEqualTo("progresspal");
        assertThat(realm.path("registrationAllowed").asBoolean()).isTrue();
        assertThat(realm.path("loginWithEmailAllowed").asBoolean()).isTrue();
        assertThat(realm.path("verifyEmail").asBoolean()).isFalse();

        JsonNode frontendClient = StreamSupport.stream(realm.path("clients").spliterator(), false)
                .filter(client -> "progresspal-frontend".equals(client.path("clientId").asText()))
                .findFirst()
                .orElseThrow();

        assertThat(frontendClient.path("publicClient").asBoolean()).isTrue();
        assertThat(frontendClient.path("standardFlowEnabled").asBoolean()).isTrue();
        assertThat(frontendClient.path("directAccessGrantsEnabled").asBoolean()).isFalse();
        assertThat(frontendClient.path("attributes").path("pkce.code.challenge.method").asText()).isEqualTo("S256");
    }
}
