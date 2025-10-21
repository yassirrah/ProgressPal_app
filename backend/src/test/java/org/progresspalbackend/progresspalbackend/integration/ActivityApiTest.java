package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.dto.session.SessionCreateDto;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class SessionApiTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("progresspal")
            .withUsername("progress")
            .withPassword("progress");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @Autowired UserRepository userRepo;
    @Autowired ActivityTypeRepository typeRepo;
    @Autowired SessionRepository sessionRepo;

    java.util.UUID userId;
    java.util.UUID typeId;

    @BeforeEach
    void setupData() {
        // delete in FK-safe order
        sessionRepo.deleteAll();
        typeRepo.deleteAll();
        userRepo.deleteAll();

        // DO NOT set IDs manually when @GeneratedValue is used
        var user = new User();
        user.setUsername("testuser");
        user.setEmail("t@t.com");
        user.setPassword("hashed");
        user.setCreatedAt(Instant.now());
        userId = userRepo.save(user).getId();

        var type = new ActivityType();
        type.setName("Studying");
        type.setIconUrl(null);
        type.setCustom(false);
        typeId = typeRepo.save(type).getId();
    }

    @Test
    void createSession_thenListByUser_returnsIt() throws Exception {
        // Assuming your SessionCreateDto = (userId, activityTypeId, title, description, visibility)
        var dto = new SessionCreateDto(
                userId,
                typeId,
                "JUnit post",
                "Made in integration test",
                Visibility.PUBLIC
        );

        // POST
        mvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(dto)))      // <-- content, not contentType
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.title").value("JUnit post"))
                .andExpect(jsonPath("$.visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.activityTypeId").value(typeId.toString()))
                .andExpect(jsonPath("$.userId").value(userId.toString()))
                .andExpect(jsonPath("$.endedAt").doesNotExist());

        // GET list (adjust if you return a paged envelope)
        mvc.perform(get("/api/sessions").param("userId", userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("JUnit post"));

        // repo sanity
        assertThat(sessionRepo.count()).isEqualTo(1);
        Session s = sessionRepo.findAll().get(0);
        assertThat(s.getEndedAt()).isNull();
        assertThat(s.getVisibility()).isEqualTo(Visibility.PUBLIC);
        assertThat(s.getActivityType().getId()).isEqualTo(typeId);
        assertThat(s.getUser().getId()).isEqualTo(userId);
    }
}
