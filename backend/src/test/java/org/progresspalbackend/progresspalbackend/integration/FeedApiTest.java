package org.progresspalbackend.progresspalbackend.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.MetricKind;
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
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
public class FeedApiTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:13-alpine")
            .withDatabaseName("progresspal")
            .withUsername("postgres")
            .withPassword("postgres");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired
    SessionRepository sessionRepo;
    @Autowired
    ActivityTypeRepository activityTypeRepo;
    @Autowired
    UserRepository userRepo;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @BeforeEach
    void cleanDb() {
        userRepo.deleteAll();
        activityTypeRepo.deleteAll();
        sessionRepo.deleteAll();
    }

    @Test
    void feed_returnsOnlyPublicSessions_orderedDesc() throws  Exception{

        User u1 = persistUser();
        User u2 = persistUser();

        ActivityType t1 = persistActivityType("Study");
        ActivityType t2 = persistActivityType("Gym");
        t1.setMetricKind(MetricKind.INTEGER);
        t1.setMetricLabel("games");
        t1 = activityTypeRepo.save(t1);

        Session pub1 = sessionRepo.save(session(u1, t1, Visibility.PUBLIC, Instant.parse("2026-01-01T10:00:00Z")));
        pub1.setMetricValue(new BigDecimal("10"));
        pub1 = sessionRepo.save(pub1);

        // PRIVATE (newer but should NOT appear)
        sessionRepo.save(session(u2, t2, Visibility.PRIVATE, Instant.parse("2026-01-03T10:00:00Z")));

        // PUBLIC (newest)
        Session pub2 = sessionRepo.save(session(u2, t2, Visibility.PUBLIC, Instant.parse("2026-01-04T10:00:00Z")));

        mockMvc.perform(get("/api/feed")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                // order desc: pub2 then pub1
                .andExpect(jsonPath("$.content[0].id").value(pub2.getId().toString()))
                .andExpect(jsonPath("$.content[1].id").value(pub1.getId().toString()))
                // sanity fields
                .andExpect(jsonPath("$.content[0].visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.content[1].visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.content[0].userId").exists())
                .andExpect(jsonPath("$.content[0].username").exists())
                .andExpect(jsonPath("$.content[0].activityTypeId").exists())
                .andExpect(jsonPath("$.content[0].activityTypeName").exists())
                .andExpect(jsonPath("$.content[1].metricValue").value(10))
                .andExpect(jsonPath("$.content[1].metricLabel").value("games"));
    }

    private User persistUser(){
        User u = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        u.setUsername("user_" + suffix);
        u.setEmail("user_" + suffix + "@test.com");
        u.setPassword("password_" + suffix);
        return userRepo.save(u);
    }

    private ActivityType persistActivityType(String baseName) {
        ActivityType t = new ActivityType();
        t.setName(baseName + "_" + UUID.randomUUID());
        return activityTypeRepo.save(t);
    }

    private Session session(User user, ActivityType type, Visibility visibility, Instant startedAt){
        Session s = new Session();
        s.setUser(user);
        s.setActivityType(type);
        s.setVisibility(visibility);
        s.setStartedAt(startedAt);
        s.setEndedAt(null);
        s.setTitle("t");
        return s;
    }
}
