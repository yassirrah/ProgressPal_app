package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.dto.dashboard.MeDashboardSummaryDto;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.progresspalbackend.progresspalbackend.service.SessionService;
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
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
public class LiveSessionApiTest {

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

    @Autowired SessionRepository sessionRepo;
    @Autowired ActivityTypeRepository activityTypeRepo;
    @Autowired UserRepository userRepo;
    @Autowired SessionService sessionService;

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void cleanDb() {
        // order matters if you have FKs; sessions -> activity types -> users
        sessionRepo.deleteAll();
        activityTypeRepo.deleteAll();
        userRepo.deleteAll();
    }

    @Test
    void live_returns200_when_live_session_exists() throws Exception {
        User u1 = persistUser();
        ActivityType t1 = persistActivityType("Study");

        // ended session (should NOT be returned)
        sessionRepo.save(session(u1, t1, Visibility.PUBLIC,
                Instant.parse("2026-01-01T10:00:00Z"),
                Instant.parse("2026-01-01T11:00:00Z")));

        // live session (should be returned)
        Session live = sessionRepo.save(session(u1, t1, Visibility.PRIVATE,
                Instant.parse("2026-01-02T10:00:00Z"),
                null));

        mockMvc.perform(get("/api/sessions/live")
                        .header("X-User-Id", u1.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(live.getId().toString()))
                .andExpect(jsonPath("$.startedAt").value("2026-01-02T10:00:00Z"))
                .andExpect(jsonPath("$.endedAt").doesNotExist()) // live => endedAt absent (or null depending on serializer)
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                // sanity
                .andExpect(jsonPath("$.activityTypeId").exists());
    }

    @Test
    void live_returns204_when_no_live_session() throws Exception {
        User u1 = persistUser();
        ActivityType t1 = persistActivityType("Study");

        // only ended session exists
        sessionRepo.save(session(u1, t1, Visibility.PUBLIC,
                Instant.parse("2026-01-01T10:00:00Z"),
                Instant.parse("2026-01-01T11:00:00Z")));

        mockMvc.perform(get("/api/sessions/live")
                        .header("X-User-Id", u1.getId().toString()))
                .andExpect(status().isNoContent());
    }

    @Test
    void live_returns401_when_auth_missing() throws Exception {
        mockMvc.perform(get("/api/sessions/live"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void create_seeds_lastSentHeartbeat() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");

        mockMvc.perform(post("/api/sessions")
                        .header("X-User-Id", user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "activityTypeId", type.getId().toString(),
                                "visibility", "PUBLIC",
                                "title", "focus"
                        ))))
                .andExpect(status().isCreated());

        Session created = sessionRepo.findAll().get(0);
        assertThat(created.getLastSentHeartBeat()).isNotNull();
        assertThat(created.getLastSentHeartBeat()).isAfterOrEqualTo(created.getStartedAt());
    }

    @Test
    void heartbeat_active_session_returns204_and_updates_lastSentHeartbeat() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");
        Session live = sessionRepo.save(session(user, type, Visibility.PUBLIC,
                Instant.now().minusSeconds(600),
                null));
        Instant previousHeartbeat = Instant.now().minusSeconds(300);
        live.setLastSentHeartBeat(previousHeartbeat);
        sessionRepo.save(live);

        mockMvc.perform(patch("/api/sessions/{id}/heartbeat", live.getId())
                        .header("X-User-Id", user.getId().toString()))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        Session updated = sessionRepo.findById(live.getId()).orElseThrow();
        assertThat(updated.getLastSentHeartBeat()).isAfter(previousHeartbeat);
    }

    @Test
    void heartbeat_afterStaleCutoff_autoPausesAtCutoff_andReturns409() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");
        Instant startedAt = Instant.now().minus(Duration.ofMinutes(40));
        Instant previousHeartbeat = Instant.now().minus(Duration.ofMinutes(20));
        Instant expectedCutoff = previousHeartbeat.plus(Duration.ofMinutes(15));

        Session live = session(user, type, Visibility.PUBLIC, startedAt, null);
        live.setLastSentHeartBeat(previousHeartbeat);
        live = sessionRepo.save(live);

        mockMvc.perform(patch("/api/sessions/{id}/heartbeat", live.getId())
                        .header("X-User-Id", user.getId().toString()))
                .andExpect(status().isConflict());

        Session updated = sessionRepo.findById(live.getId()).orElseThrow();
        assertThat(updated.getPausedAt()).isEqualTo(expectedCutoff);
        assertThat(updated.getEndedAt()).isNull();
    }

    @Test
    void lateHeartbeat_doesNotBumpLastSentHeartbeat() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");
        Session live = session(user, type, Visibility.PUBLIC,
                Instant.now().minus(Duration.ofMinutes(40)),
                null);
        Instant previousHeartbeat = Instant.now().minus(Duration.ofMinutes(20));
        live.setLastSentHeartBeat(previousHeartbeat);
        live = sessionRepo.save(live);

        mockMvc.perform(patch("/api/sessions/{id}/heartbeat", live.getId())
                        .header("X-User-Id", user.getId().toString()))
                .andExpect(status().isConflict());

        Session updated = sessionRepo.findById(live.getId()).orElseThrow();
        assertThat(updated.getLastSentHeartBeat()).isEqualTo(previousHeartbeat);
    }

    @Test
    void heartbeat_uses_startedAt_cutoff_when_lastHeartbeat_missing() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");
        Instant startedAt = Instant.now().minus(Duration.ofMinutes(20));
        Instant expectedCutoff = startedAt.plus(Duration.ofMinutes(15));

        Session live = session(user, type, Visibility.PUBLIC, startedAt, null);
        live.setLastSentHeartBeat(null);
        live = sessionRepo.save(live);

        mockMvc.perform(patch("/api/sessions/{id}/heartbeat", live.getId())
                        .header("X-User-Id", user.getId().toString()))
                .andExpect(status().isConflict());

        Session updated = sessionRepo.findById(live.getId()).orElseThrow();
        assertThat(updated.getPausedAt()).isEqualTo(expectedCutoff);
        assertThat(updated.getLastSentHeartBeat()).isNull();
    }

    @Test
    void heartbeat_nonOwner_returns403() throws Exception {
        User owner = persistUser();
        User otherUser = persistUser();
        ActivityType type = persistActivityType("Study");
        Session live = sessionRepo.save(session(owner, type, Visibility.PUBLIC,
                Instant.now().minusSeconds(600),
                null));

        mockMvc.perform(patch("/api/sessions/{id}/heartbeat", live.getId())
                        .header("X-User-Id", otherUser.getId().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void heartbeat_paused_session_returns409() throws Exception {
        User owner = persistUser();
        ActivityType type = persistActivityType("Study");
        Session live = session(owner, type, Visibility.PUBLIC,
                Instant.now().minusSeconds(600),
                null);
        live.setPausedAt(Instant.now().minusSeconds(30));
        live = sessionRepo.save(live);

        mockMvc.perform(patch("/api/sessions/{id}/heartbeat", live.getId())
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isConflict());
    }

    @Test
    void heartbeat_stopped_session_returns409() throws Exception {
        User owner = persistUser();
        ActivityType type = persistActivityType("Study");
        Session stopped = sessionRepo.save(session(owner, type, Visibility.PUBLIC,
                Instant.now().minusSeconds(600),
                Instant.now().minusSeconds(60)));

        mockMvc.perform(patch("/api/sessions/{id}/heartbeat", stopped.getId())
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isConflict());
    }

    @Test
    void live_normalizes_stale_session_into_paused_session() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");
        Instant startedAt = Instant.now().minus(Duration.ofMinutes(40));
        Instant lastHeartbeat = Instant.now().minus(Duration.ofMinutes(20));
        Instant expectedCutoff = lastHeartbeat.plus(Duration.ofMinutes(15));

        Session live = session(user, type, Visibility.PUBLIC, startedAt, null);
        live.setLastSentHeartBeat(lastHeartbeat);
        live = sessionRepo.save(live);

        mockMvc.perform(get("/api/sessions/live")
                        .header("X-User-Id", user.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(live.getId().toString()))
                .andExpect(jsonPath("$.paused").value(true))
                .andExpect(jsonPath("$.ongoing").value(false))
                .andExpect(jsonPath("$.pausedAt").value(expectedCutoff.toString()));

        Session normalized = sessionRepo.findById(live.getId()).orElseThrow();
        assertThat(normalized.getPausedAt()).isEqualTo(expectedCutoff);
        assertThat(normalized.getEndedAt()).isNull();
    }

    @Test
    void staleSweeper_autoPausesAtCutoff_andDurationStopsGrowing() {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");
        Instant startedAt = Instant.now().minus(Duration.ofMinutes(50));
        Instant lastHeartbeat = Instant.now().minus(Duration.ofMinutes(25));
        Instant expectedCutoff = lastHeartbeat.plus(Duration.ofMinutes(15));

        Session live = session(user, type, Visibility.PUBLIC, startedAt, null);
        live.setLastSentHeartBeat(lastHeartbeat);
        live = sessionRepo.save(live);

        sessionService.autoPauseStaleLiveSessions();

        Session paused = sessionRepo.findById(live.getId()).orElseThrow();
        assertThat(paused.getPausedAt()).isEqualTo(expectedCutoff);
        assertThat(paused.getEndedAt()).isNull();

        MeDashboardSummaryDto summary = sessionService.getMyDashboardSummary(user.getId(), null, null);
        long expectedDurationSeconds = Duration.between(startedAt, expectedCutoff).getSeconds();
        assertThat(summary.totalDurationSeconds()).isEqualTo(expectedDurationSeconds);
    }

    @Test
    void resume_afterStaleAutoPause_reseedsHeartbeat_and_preservesPausedDuration() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");
        Instant startedAt = Instant.now().minus(Duration.ofMinutes(50));
        Instant lastHeartbeat = Instant.now().minus(Duration.ofMinutes(25));
        Instant expectedCutoff = lastHeartbeat.plus(Duration.ofMinutes(15));

        Session live = session(user, type, Visibility.PUBLIC, startedAt, null);
        live.setLastSentHeartBeat(lastHeartbeat);
        live = sessionRepo.save(live);

        sessionService.autoPauseStaleLiveSessions();

        mockMvc.perform(patch("/api/sessions/{id}/resume", live.getId())
                        .header("X-User-Id", user.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paused").value(false));

        Session resumed = sessionRepo.findById(live.getId()).orElseThrow();
        assertThat(resumed.getPausedAt()).isNull();
        assertThat(resumed.getEndedAt()).isNull();
        assertThat(resumed.getLastSentHeartBeat()).isAfter(lastHeartbeat);
        assertThat(resumed.getPausedDurationSeconds())
                .isEqualTo(Duration.between(expectedCutoff, resumed.getLastSentHeartBeat()).getSeconds());
    }

    // ---------- helpers ----------

    private User persistUser() {
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
        // if your entity requires visibility/isCustom/createdBy, set them here too
        return activityTypeRepo.save(t);
    }

    private Session session(User user, ActivityType type, Visibility visibility, Instant startedAt, Instant endedAt) {
        Session s = new Session();
        s.setUser(user);
        s.setActivityType(type);
        s.setVisibility(visibility);
        s.setStartedAt(startedAt);
        s.setEndedAt(endedAt);
        s.setTitle("t");
        return s;
    }
}
