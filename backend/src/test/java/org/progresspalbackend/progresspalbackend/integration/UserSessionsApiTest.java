package org.progresspalbackend.progresspalbackend.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.UUID;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
public class UserSessionsApiTest {


    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:13-alpine")
            .withDatabaseName("progresspal")
            .withUsername("progress")
            .withPassword("progress");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", db::getJdbcUrl);
        registry.add("spring.datasource.username", db::getUsername);
        registry.add("spring.datasource.password", db::getPassword);
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); // ✅ fixed typo
    }


    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired SessionRepository sessionRepo;
    @Autowired ActivityTypeRepository activityTypeRepo;
    @Autowired UserRepository userRepo;

    @BeforeEach
    void cleanDb() {
        sessionRepo.deleteAll();
        activityTypeRepo.deleteAll();
    }

    @Test
    void owner_noVisibility_returnsAllSessions_orderedDesc() throws Exception {
        User user = persistUser();

        ActivityType type = persistActivityType("Study");

        Session olderPublic = sessionRepo.save(session(user, type, Visibility.PUBLIC,
                Instant.parse("2026-01-01T10:00:00Z")));

        Session newestPrivate = sessionRepo.save(session(user, type, Visibility.PRIVATE,
                Instant.parse("2026-01-03T10:00:00Z")));

        Session middlePublic = sessionRepo.save(session(user, type, Visibility.PUBLIC,
                Instant.parse("2026-01-02T10:00:00Z")));

        mvc.perform(get("/api/users/{userId}/sessions", user.getId())
                    .header("X-User-Id", user.getId().toString())
                    .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                // desc by startedAt: newestPrivate, middlePublic, olderPublic
                .andExpect(jsonPath("$[0].id").value(newestPrivate.getId().toString()))
                .andExpect(jsonPath("$[1].id").value(middlePublic.getId().toString()))
                .andExpect(jsonPath("$[2].id").value(olderPublic.getId().toString()));

    }

    @Test
    void owner_withVisibility_filters_and_ordersDesc() throws Exception {
        User user = persistUser();

        ActivityType type = persistActivityType("Gym");

        Session p1 = sessionRepo.save(session(user, type, Visibility.PRIVATE,
                Instant.parse("2026-01-01T10:00:00Z")));

        sessionRepo.save(session(user, type, Visibility.PUBLIC,
                Instant.parse("2026-01-03T10:00:00Z")));

        Session p2 = sessionRepo.save(session(user, type, Visibility.PRIVATE,
                Instant.parse("2026-01-02T10:00:00Z")));

        mvc.perform(get("/api/users/{userId}/sessions", user.getId())
                        .queryParam("visibility", "PRIVATE")
                        .header("X-User-Id", user.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                // desc: p2 then p1
                .andExpect(jsonPath("$[0].id").value(p2.getId().toString()))
                .andExpect(jsonPath("$[1].id").value(p1.getId().toString()))
                .andExpect(jsonPath("$[0].visibility").value("PRIVATE"))
                .andExpect(jsonPath("$[1].visibility").value("PRIVATE"));
    }

    @Test
    void nonOwner_alwaysGetsPublicOnly_evenIfVisibilityParamProvided() throws Exception {
        User target = persistUser();
        User actor = persistUser();

        ActivityType type = persistActivityType("Reading");

        Session pub = sessionRepo.save(session(target, type, Visibility.PUBLIC,
                Instant.parse("2026-01-02T10:00:00Z")));

        sessionRepo.save(session(target, type, Visibility.PRIVATE,
                Instant.parse("2026-01-03T10:00:00Z")));

        mvc.perform(get("/api/users/{userId}/sessions", target.getId())
                        .queryParam("visibility", "PRIVATE") // must be ignored for non-owner
                        .header("X-User-Id", actor.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(pub.getId().toString()))
                .andExpect(jsonPath("$[0].visibility").value("PUBLIC"));
    }

    private User persistUser() {
        User u = new User();

        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);

        u.setUsername("user_" + suffix);                 // <= 50 chars, unique
        u.setEmail("user_" + suffix + "@test.com");      // unique
        u.setPassword("password_" + suffix);             // non-null (hash not required for MVP tests)

        return userRepo.save(u);
    }

    private ActivityType persistActivityType(String name) {
        ActivityType t = new ActivityType();

        // Common fields examples — adjust to your actual domain
        // If ActivityType is an enum seeded by migration, you might NOT want to save in tests.
        t.setName(name);

        return activityTypeRepo.save(t);
    }


    private Session session(User user, ActivityType type, Visibility visibility, Instant startedAt) {
        Session s = new Session();

        // Must match your entity:
        s.setUser(user);
        s.setVisibility(visibility);
        s.setStartedAt(startedAt);
        s.setEndedAt(null);

        // Choose ONE of these depending on your model:

        // A) If Session has relation:
        s.setActivityType(type);

        // B) If Session stores FK id instead:
        // s.setActivityTypeId(type.getId());

        // Set any other required fields (title/note/etc.) if your entity enforces them
        return s;
    }
}
