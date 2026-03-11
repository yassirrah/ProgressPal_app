package org.progresspalbackend.progresspalbackend.integration;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequest;
import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequestStatus;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionJoinRequestRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRoomMessageRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
class SessionJoinRoomApiTest {

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

    @Autowired
    MockMvc mvc;

    @Autowired
    UserRepository userRepository;

    @Autowired
    ActivityTypeRepository activityTypeRepository;

    @Autowired
    SessionRepository sessionRepository;

    @Autowired
    FriendRepository friendRepository;

    @Autowired
    SessionJoinRequestRepository sessionJoinRequestRepository;

    @Autowired
    SessionRoomMessageRepository sessionRoomMessageRepository;

    @BeforeEach
    void cleanDb() {
        sessionRoomMessageRepository.deleteAll();
        sessionJoinRequestRepository.deleteAll();
        sessionRepository.deleteAll();
        friendRepository.deleteAll();
        activityTypeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void submitJoinRequest_success_forVisibleLiveSession() throws Exception {
        User host = persistUser("host");
        User requester = persistUser("requester");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.FRIENDS, false);
        persistFriendship(host, requester);

        mvc.perform(post("/api/sessions/{sessionId}/join-requests", session.getId())
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").value(session.getId().toString()))
                .andExpect(jsonPath("$.requesterId").value(requester.getId().toString()))
                .andExpect(jsonPath("$.status").value("PENDING"));

        assertThat(sessionJoinRequestRepository.findAll()).hasSize(1);
    }

    @Test
    void submitJoinRequest_blocked_forOwnSession() throws Exception {
        User host = persistUser("host");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);

        mvc.perform(post("/api/sessions/{sessionId}/join-requests", session.getId())
                        .header("X-User-Id", host.getId().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void submitJoinRequest_blocked_forInaccessiblePrivateSession() throws Exception {
        User host = persistUser("host");
        User requester = persistUser("requester");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PRIVATE, false);

        mvc.perform(post("/api/sessions/{sessionId}/join-requests", session.getId())
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void submitJoinRequest_blocked_forEndedSession() throws Exception {
        User host = persistUser("host");
        User requester = persistUser("requester");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, true);

        mvc.perform(post("/api/sessions/{sessionId}/join-requests", session.getId())
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isConflict());
    }

    @Test
    void submitJoinRequest_blocked_forDuplicateRequestInAnyStatus() throws Exception {
        User host = persistUser("host");
        User requester = persistUser("requester");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);
        persistJoinRequest(session, requester, SessionJoinRequestStatus.REJECTED);

        mvc.perform(post("/api/sessions/{sessionId}/join-requests", session.getId())
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isConflict());
    }

    @Test
    void hostIncomingList_andAcceptReject_flow() throws Exception {
        User host = persistUser("host");
        User requesterA = persistUser("requesterA");
        User requesterB = persistUser("requesterB");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);
        SessionJoinRequest requestA = persistJoinRequest(session, requesterA, SessionJoinRequestStatus.PENDING);
        SessionJoinRequest requestB = persistJoinRequest(session, requesterB, SessionJoinRequestStatus.PENDING);

        mvc.perform(get("/api/sessions/{sessionId}/join-requests/incoming", session.getId())
                        .header("X-User-Id", host.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mvc.perform(patch("/api/sessions/{sessionId}/join-requests/{requestId}", session.getId(), requestA.getId())
                        .header("X-User-Id", host.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"ACCEPT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.respondedAt").isNotEmpty());

        mvc.perform(patch("/api/sessions/{sessionId}/join-requests/{requestId}", session.getId(), requestB.getId())
                        .header("X-User-Id", host.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.respondedAt").isNotEmpty());

        mvc.perform(get("/api/sessions/{sessionId}/join-requests/incoming", session.getId())
                        .header("X-User-Id", host.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void requesterOutgoing_reflectsStatusTransition() throws Exception {
        User host = persistUser("host");
        User requester = persistUser("requester");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);

        String createBody = mvc.perform(post("/api/sessions/{sessionId}/join-requests", session.getId())
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String requestId = JsonPath.read(createBody, "$.id");

        mvc.perform(get("/api/me/join-requests/outgoing")
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].requestId").value(requestId))
                .andExpect(jsonPath("$[0].status").value("PENDING"));

        mvc.perform(patch("/api/sessions/{sessionId}/join-requests/{requestId}", session.getId(), requestId)
                        .header("X-User-Id", host.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"ACCEPT\"}"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/me/join-requests/outgoing")
                        .header("X-User-Id", requester.getId().toString())
                        .param("status", "ACCEPTED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].requestId").value(requestId))
                .andExpect(jsonPath("$[0].status").value("ACCEPTED"));
    }

    @Test
    void roomAccess_acceptedParticipant_canReadAndChat() throws Exception {
        User host = persistUser("host");
        User participant = persistUser("participant");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);
        persistJoinRequest(session, participant, SessionJoinRequestStatus.ACCEPTED);

        mvc.perform(get("/api/sessions/{sessionId}/room", session.getId())
                        .header("X-User-Id", participant.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value(session.getId().toString()))
                .andExpect(jsonPath("$.host.id").value(host.getId().toString()))
                .andExpect(jsonPath("$.participants.length()").value(1))
                .andExpect(jsonPath("$.participants[0].id").value(participant.getId().toString()))
                .andExpect(jsonPath("$.live").value(true));

        mvc.perform(get("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participant.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));

        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participant.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"  hello room  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").value(session.getId().toString()))
                .andExpect(jsonPath("$.senderId").value(participant.getId().toString()))
                .andExpect(jsonPath("$.content").value("hello room"));

        mvc.perform(get("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participant.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].content").value("hello room"));
    }

    @Test
    void roomAccess_rejectedOrNonParticipant_getForbidden() throws Exception {
        User host = persistUser("host");
        User rejectedUser = persistUser("rejected");
        User stranger = persistUser("stranger");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);
        persistJoinRequest(session, rejectedUser, SessionJoinRequestStatus.REJECTED);

        mvc.perform(get("/api/sessions/{sessionId}/room", session.getId())
                        .header("X-User-Id", rejectedUser.getId().toString()))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", stranger.getId().toString()))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", stranger.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"hello\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void roomAccess_whenSessionEnded_returnsConflict() throws Exception {
        User host = persistUser("host");
        User participant = persistUser("participant");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, true);
        persistJoinRequest(session, participant, SessionJoinRequestStatus.ACCEPTED);

        mvc.perform(get("/api/sessions/{sessionId}/room", session.getId())
                        .header("X-User-Id", participant.getId().toString()))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participant.getId().toString()))
                .andExpect(status().isConflict());

        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participant.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"hello\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void roomMessage_validation_blankAndTooLong() throws Exception {
        User host = persistUser("host");
        User participant = persistUser("participant");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);
        persistJoinRequest(session, participant, SessionJoinRequestStatus.ACCEPTED);

        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participant.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"   \"}"))
                .andExpect(status().isBadRequest());

        String tooLong = "a".repeat(1001);
        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participant.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"" + tooLong + "\"}"))
                .andExpect(status().isBadRequest());
    }

    private User persistUser(String prefix) {
        User user = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        user.setUsername(prefix + "_" + suffix);
        user.setEmail(prefix + "_" + suffix + "@test.com");
        user.setPassword("password");
        return userRepository.save(user);
    }

    private ActivityType persistActivityType(String baseName) {
        ActivityType type = new ActivityType();
        type.setName(baseName + "_" + UUID.randomUUID());
        return activityTypeRepository.save(type);
    }

    private Session persistSession(User host, ActivityType type, Visibility visibility, boolean ended) {
        Session session = new Session();
        session.setUser(host);
        session.setActivityType(type);
        session.setVisibility(visibility);
        session.setTitle("focus");
        session.setStartedAt(Instant.now().minusSeconds(120));
        session.setEndedAt(ended ? Instant.now() : null);
        return sessionRepository.save(session);
    }

    private void persistFriendship(User user, User friend) {
        Friendship friendship = new Friendship();
        friendship.setUser(user);
        friendship.setFriend(friend);
        friendship.setCreatedAt(Instant.now());
        friendRepository.save(friendship);
    }

    private SessionJoinRequest persistJoinRequest(Session session, User requester, SessionJoinRequestStatus status) {
        SessionJoinRequest request = new SessionJoinRequest();
        request.setSession(session);
        request.setRequester(requester);
        request.setStatus(status);
        request.setCreatedAt(Instant.now());
        request.setRespondedAt(status == SessionJoinRequestStatus.PENDING ? null : Instant.now());
        return sessionJoinRequestRepository.save(request);
    }
}
