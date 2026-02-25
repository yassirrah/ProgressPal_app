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
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class MeDashboardSummaryApiTest {

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
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired MockMvc mvc;
    @Autowired SessionRepository sessionRepo;
    @Autowired ActivityTypeRepository activityTypeRepo;
    @Autowired UserRepository userRepo;

    @BeforeEach
    void cleanDb() {
        sessionRepo.deleteAll();
        activityTypeRepo.deleteAll();
        userRepo.deleteAll();
    }

    @Test
    void dashboardSummary_matchesDateRangeListConsistency_andReturnsAggregates() throws Exception {
        User me = persistUser();
        User other = persistUser();

        ActivityType chess = persistActivityType("Chess");
        ActivityType reading = persistActivityType("Reading");
        ActivityType coding = persistActivityType("Coding");
        ActivityType gym = persistActivityType("Gym");
        ActivityType outsideType = persistActivityType("Outside");

        sessionRepo.save(session(me, chess, Visibility.PUBLIC, Instant.parse("2026-01-03T10:00:00Z"), 3600));
        sessionRepo.save(session(me, reading, Visibility.PRIVATE, Instant.parse("2026-01-03T12:00:00Z"), 1800));
        sessionRepo.save(session(me, chess, Visibility.PUBLIC, Instant.parse("2026-01-04T10:00:00Z"), 1200));
        sessionRepo.save(session(me, coding, Visibility.PUBLIC, Instant.parse("2026-01-05T09:00:00Z"), 2700));
        sessionRepo.save(session(me, gym, Visibility.PRIVATE, Instant.parse("2026-01-05T11:00:00Z"), 600));

        sessionRepo.save(session(me, outsideType, Visibility.PUBLIC, Instant.parse("2026-01-06T09:00:00Z"), 999)); // after range
        sessionRepo.save(session(me, chess, Visibility.PUBLIC, Instant.parse("2026-01-02T23:50:00Z"), 900)); // before range
        sessionRepo.save(session(other, chess, Visibility.PUBLIC, Instant.parse("2026-01-04T08:00:00Z"), 7200)); // other user

        mvc.perform(get("/api/me/sessions")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("from", "2026-01-03")
                        .queryParam("to", "2026-01-05")
                        .queryParam("size", "100")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(5));

        mvc.perform(get("/api/me/dashboard/summary")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("from", "2026-01-03")
                        .queryParam("to", "2026-01-05")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSessions").value(5))
                .andExpect(jsonPath("$.totalDurationSeconds").value(9900))
                .andExpect(jsonPath("$.activeDays").value(3))
                .andExpect(jsonPath("$.topActivityTypesByTime.length()").value(3))
                .andExpect(jsonPath("$.topActivityTypesByTime[0].activityTypeId").value(chess.getId().toString()))
                .andExpect(jsonPath("$.topActivityTypesByTime[0].activityTypeName").value(chess.getName()))
                .andExpect(jsonPath("$.topActivityTypesByTime[0].totalDurationSeconds").value(4800))
                .andExpect(jsonPath("$.topActivityTypesByTime[1].activityTypeId").value(coding.getId().toString()))
                .andExpect(jsonPath("$.topActivityTypesByTime[1].activityTypeName").value(coding.getName()))
                .andExpect(jsonPath("$.topActivityTypesByTime[1].totalDurationSeconds").value(2700))
                .andExpect(jsonPath("$.topActivityTypesByTime[2].activityTypeId").value(reading.getId().toString()))
                .andExpect(jsonPath("$.topActivityTypesByTime[2].activityTypeName").value(reading.getName()))
                .andExpect(jsonPath("$.topActivityTypesByTime[2].totalDurationSeconds").value(1800));
    }

    @Test
    void dashboardSummary_rejectsInvalidDateRange() throws Exception {
        User me = persistUser();

        mvc.perform(get("/api/me/dashboard/summary")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("from", "2026-01-10")
                        .queryParam("to", "2026-01-01")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("'from' must be before or equal to 'to'"));
    }

    private User persistUser() {
        User u = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        u.setUsername("user_" + suffix);
        u.setEmail("user_" + suffix + "@test.com");
        u.setPassword("password_" + suffix);
        return userRepo.save(u);
    }

    private ActivityType persistActivityType(String base) {
        ActivityType t = new ActivityType();
        t.setName(base + "_" + UUID.randomUUID());
        return activityTypeRepo.save(t);
    }

    private Session session(User user, ActivityType type, Visibility visibility, Instant startedAt, long durationSeconds) {
        Session s = new Session();
        s.setUser(user);
        s.setActivityType(type);
        s.setVisibility(visibility);
        s.setStartedAt(startedAt);
        s.setEndedAt(startedAt.plusSeconds(durationSeconds));
        s.setTitle("t");
        return s;
    }
}
