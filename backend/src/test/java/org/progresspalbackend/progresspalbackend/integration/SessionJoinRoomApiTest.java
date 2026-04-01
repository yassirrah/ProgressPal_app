package org.progresspalbackend.progresspalbackend.integration;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.progresspalbackend.progresspalbackend.domain.Notification;
import org.progresspalbackend.progresspalbackend.domain.NotificationResourceType;
import org.progresspalbackend.progresspalbackend.domain.NotificationType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequest;
import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequestStatus;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.NotificationRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionJoinRequestRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRoomMessageRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.progresspalbackend.progresspalbackend.service.NotificationService;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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
    NotificationRepository notificationRepository;

    @Autowired
    NotificationService notificationService;

    @Autowired
    SessionJoinRequestRepository sessionJoinRequestRepository;

    @Autowired
    SessionRoomMessageRepository sessionRoomMessageRepository;

    @BeforeEach
    void cleanDb() {
        notificationRepository.deleteAll();
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
        assertThat(notificationRepository.findAll()).hasSize(1);
        Notification notification = notificationRepository.findAll().get(0);
        assertThat(notification.getRecipient().getId()).isEqualTo(host.getId());
        assertThat(notification.getActor().getId()).isEqualTo(requester.getId());
        assertThat(notification.getType()).isEqualTo(NotificationType.SESSION_JOIN_REQUEST_RECEIVED);
        assertThat(notification.getResourceType()).isEqualTo(NotificationResourceType.SESSION);
        assertThat(notification.getResourceId()).isEqualTo(session.getId());
        assertThat(notification.getReadAt()).isNull();
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
    void acceptJoinRequest_createsRequesterNotification_andMarksHostJoinRequestNotificationRead() throws Exception {
        User host = persistUser("host");
        User requester = persistUser("requester");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);
        String joinRequestBody = mvc.perform(post("/api/sessions/{sessionId}/join-requests", session.getId())
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String requestId = JsonPath.read(joinRequestBody, "$.id");

        mvc.perform(patch("/api/sessions/{sessionId}/join-requests/{requestId}", session.getId(), requestId)
                        .header("X-User-Id", host.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"ACCEPT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        assertThat(notificationRepository.findAll()).hasSize(2);

        Notification requesterNotification = notificationRepository.findAll().stream()
                .filter(notification -> notification.getRecipient().getId().equals(requester.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(requesterNotification.getActor().getId()).isEqualTo(host.getId());
        assertThat(requesterNotification.getType()).isEqualTo(NotificationType.SESSION_JOIN_REQUEST_ACCEPTED);
        assertThat(requesterNotification.getResourceType()).isEqualTo(NotificationResourceType.SESSION);
        assertThat(requesterNotification.getResourceId()).isEqualTo(session.getId());
        assertThat(requesterNotification.getMessage()).isEqualTo(host.getUsername() + " accepted your join request.");
        assertThat(requesterNotification.getReadAt()).isNull();

        Notification hostNotification = notificationRepository.findAll().stream()
                .filter(notification -> notification.getRecipient().getId().equals(host.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(hostNotification.getActor().getId()).isEqualTo(requester.getId());
        assertThat(hostNotification.getType()).isEqualTo(NotificationType.SESSION_JOIN_REQUEST_RECEIVED);
        assertThat(hostNotification.getReadAt()).isNotNull();
    }

    @Test
    void rejectJoinRequest_doesNotCreateRequesterNotification_andMarksHostJoinRequestNotificationRead() throws Exception {
        User host = persistUser("host");
        User requester = persistUser("requester");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);
        String joinRequestBody = mvc.perform(post("/api/sessions/{sessionId}/join-requests", session.getId())
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String requestId = JsonPath.read(joinRequestBody, "$.id");

        mvc.perform(patch("/api/sessions/{sessionId}/join-requests/{requestId}", session.getId(), requestId)
                        .header("X-User-Id", host.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));

        assertThat(notificationRepository.findAll()).hasSize(1);
        Notification hostNotification = notificationRepository.findAll().get(0);
        assertThat(hostNotification.getRecipient().getId()).isEqualTo(host.getId());
        assertThat(hostNotification.getActor().getId()).isEqualTo(requester.getId());
        assertThat(hostNotification.getType()).isEqualTo(NotificationType.SESSION_JOIN_REQUEST_RECEIVED);
        assertThat(hostNotification.getReadAt()).isNotNull();
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

        assertThat(notificationRepository.findAll()).hasSize(1);
        Notification notification = notificationRepository.findAll().get(0);
        assertThat(notification.getRecipient().getId()).isEqualTo(host.getId());
        assertThat(notification.getActor().getId()).isEqualTo(participant.getId());
        assertThat(notification.getType()).isEqualTo(NotificationType.SESSION_ROOM_MESSAGE_RECEIVED);
        assertThat(notification.getResourceType()).isEqualTo(NotificationResourceType.SESSION);
        assertThat(notification.getResourceId()).isEqualTo(session.getId());
        assertThat(notification.getReadAt()).isNull();
    }

    @Test
    void secondUnreadParticipantRoomMessage_sameSession_updatesExistingUnreadNotification() throws Exception {
        User host = persistUser("host");
        User participantA = persistUser("participantA");
        User participantB = persistUser("participantB");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);
        persistJoinRequest(session, participantA, SessionJoinRequestStatus.ACCEPTED);
        persistJoinRequest(session, participantB, SessionJoinRequestStatus.ACCEPTED);

        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participantA.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"first\"}"))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participantB.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"second\"}"))
                .andExpect(status().isCreated());

        assertThat(notificationRepository.findAll()).hasSize(1);
        Notification notification = notificationRepository.findAll().get(0);
        assertThat(notification.getType()).isEqualTo(NotificationType.SESSION_ROOM_MESSAGE_RECEIVED);
        assertThat(notification.getRecipient().getId()).isEqualTo(host.getId());
        assertThat(notification.getActor().getId()).isEqualTo(participantB.getId());
        assertThat(notification.getMessage()).isEqualTo(participantB.getUsername() + " sent a message in your room.");
        assertThat(notification.getReadAt()).isNull();
    }

    @Test
    void hostAuthoredRoomMessage_createsNoHostRoomMessageNotification() throws Exception {
        User host = persistUser("host");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);

        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", host.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"host update\"}"))
                .andExpect(status().isCreated());

        assertThat(notificationRepository.findAll()).isEmpty();
    }

    @Test
    void roomMessage_afterUnreadNotificationIsRead_createsNewUnreadNotification() throws Exception {
        User host = persistUser("host");
        User participant = persistUser("participant");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);
        persistJoinRequest(session, participant, SessionJoinRequestStatus.ACCEPTED);

        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participant.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"first\"}"))
                .andExpect(status().isCreated());

        Notification firstNotification = notificationRepository.findAll().get(0);

        mvc.perform(patch("/api/me/notifications/{notificationId}/read", firstNotification.getId())
                        .header("X-User-Id", host.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readAt").isNotEmpty());

        mvc.perform(post("/api/sessions/{sessionId}/room/messages", session.getId())
                        .header("X-User-Id", participant.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"second\"}"))
                .andExpect(status().isCreated());

        assertThat(notificationRepository.findAll()).hasSize(2);
        long unreadNotifications = notificationRepository.findAll().stream()
                .filter(notification -> notification.getReadAt() == null)
                .count();
        assertThat(unreadNotifications).isEqualTo(1);

        Notification unreadNotification = notificationRepository.findAll().stream()
                .filter(notification -> notification.getReadAt() == null)
                .findFirst()
                .orElseThrow();
        assertThat(unreadNotification.getId()).isNotEqualTo(firstNotification.getId());
        assertThat(unreadNotification.getType()).isEqualTo(NotificationType.SESSION_ROOM_MESSAGE_RECEIVED);
        assertThat(unreadNotification.getMessage()).isEqualTo(participant.getUsername() + " sent a message in your room.");
    }

    @Test
    void concurrentRoomMessageNotifications_keepSingleUnreadNotificationRow() throws Exception {
        User host = persistUser("host");
        User participantA = persistUser("participantA");
        User participantB = persistUser("participantB");
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(host, type, Visibility.PUBLIC, false);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try {
            Future<?> firstNotification = executor.submit(() ->
                    sendConcurrentRoomNotification(host, participantA, session.getId(), ready, start));
            Future<?> secondNotification = executor.submit(() ->
                    sendConcurrentRoomNotification(host, participantB, session.getId(), ready, start));

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            firstNotification.get(5, TimeUnit.SECONDS);
            secondNotification.get(5, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }

        assertThat(notificationRepository.findAll()).hasSize(1);
        Notification notification = notificationRepository.findAll().get(0);
        assertThat(notification.getRecipient().getId()).isEqualTo(host.getId());
        assertThat(notification.getType()).isEqualTo(NotificationType.SESSION_ROOM_MESSAGE_RECEIVED);
        assertThat(notification.getResourceType()).isEqualTo(NotificationResourceType.SESSION);
        assertThat(notification.getResourceId()).isEqualTo(session.getId());
        assertThat(notification.getReadAt()).isNull();
        assertThat(notification.getActor().getId()).isIn(participantA.getId(), participantB.getId());
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

    private void sendConcurrentRoomNotification(User host,
                                                User participant,
                                                UUID sessionId,
                                                CountDownLatch ready,
                                                CountDownLatch start) {
        try {
            ready.countDown();
            if (!start.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Timed out waiting to start concurrent notification write");
            }
            notificationService.notifySessionRoomMessageReceived(host, participant, sessionId);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting to send concurrent notification", ex);
        }
    }
}
