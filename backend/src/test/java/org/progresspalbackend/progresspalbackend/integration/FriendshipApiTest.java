package org.progresspalbackend.progresspalbackend.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.FriendRequest;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.progresspalbackend.progresspalbackend.domain.FriendshipStatus;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.SessionComment;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRequestRepository;
import org.progresspalbackend.progresspalbackend.repository.NotificationRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionCommentRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionReactionRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
class FriendshipApiTest {

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

    @Autowired
    MockMvc mvc;

    @Autowired
    UserRepository userRepo;

    @Autowired
    FriendRequestRepository requestRepo;

    @Autowired
    FriendRepository friendRepo;

    @Autowired
    SessionRepository sessionRepo;

    @Autowired
    SessionCommentRepository commentRepo;

    @Autowired
    SessionReactionRepository reactionRepo;

    @Autowired
    ActivityTypeRepository activityTypeRepo;

    @Autowired
    NotificationRepository notificationRepo;

    @BeforeEach
    void cleanDb() {
        commentRepo.deleteAll();
        reactionRepo.deleteAll();
        sessionRepo.deleteAll();
        friendRepo.deleteAll();
        requestRepo.deleteAll();
        notificationRepo.deleteAll();
        userRepo.deleteAll();
    }

    @Test
    void send_then_accept_then_listFriends_forBothUsers() throws Exception {
        User requester = persistUser();
        User receiver = persistUser();

        //this log passes
        System.out.println("start of the test method");

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", requester.getId().toString())
                        .param("receiverId", receiver.getId().toString()))
                .andExpect(status().isCreated());

        //this log doesn't pass, which means that there is an issue in the post method, i've tried post man and verified that the post method works
        System.out.println("post method sent successfully to send a request to a friend");

        FriendRequest pending = requestRepo.findByRequester_IdAndReceiver_Id(requester.getId(), receiver.getId());
        assertThat(pending).isNotNull();
        assertThat(pending.getStatus()).isEqualTo(FriendshipStatus.PENDING);

        mvc.perform(get("/api/friends/requests/incoming")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].requesterId").value(requester.getId().toString()))
                .andExpect(jsonPath("$[0].requesterUsername").value(requester.getUsername()));

        mvc.perform(patch("/api/friends/accept")
                        .header("X-User-Id", receiver.getId().toString())
                        .param("requesterId", requester.getId().toString()))
                .andExpect(status().isOk());

        System.out.println("post method sent successfully to accept the request");

        FriendRequest accepted = requestRepo.findByRequester_IdAndReceiver_Id(requester.getId(), receiver.getId());
        assertThat(accepted.getStatus()).isEqualTo(FriendshipStatus.ACCEPTED);
        assertThat(friendRepo.count()).isEqualTo(1);

        mvc.perform(get("/api/friends")
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].FriendId").value(receiver.getId().toString()));

        System.out.println("get method sent successfully to get the friends of the requester");

        mvc.perform(get("/api/friends")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].FriendId").value(requester.getId().toString()));

        System.out.println("get method sent successfully to get the friends of the receiver");
    }

    @Test
    void sendRequest_toSelf_returns403() throws Exception {
        User user = persistUser();

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", user.getId().toString())
                        .param("receiverId", user.getId().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void duplicatePendingRequest_returns403() throws Exception {
        User requester = persistUser();
        User receiver = persistUser();

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", requester.getId().toString())
                        .param("receiverId", receiver.getId().toString()))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", requester.getId().toString())
                        .param("receiverId", receiver.getId().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void acceptRequest_notFound_returns404() throws Exception {
        User receiver = persistUser();
        UUID unknownRequester = UUID.randomUUID();

        mvc.perform(patch("/api/friends/accept")
                        .header("X-User-Id", receiver.getId().toString())
                        .param("requesterId", unknownRequester.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void send_then_reject_marksRequestRejected_and_notInIncomingList() throws Exception {
        User requester = persistUser();
        User receiver = persistUser();

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", requester.getId().toString())
                        .param("receiverId", receiver.getId().toString()))
                .andExpect(status().isCreated());

        mvc.perform(patch("/api/friends/reject")
                        .header("X-User-Id", receiver.getId().toString())
                        .param("requesterId", requester.getId().toString()))
                .andExpect(status().isOk());

        FriendRequest rejected = requestRepo.findByRequester_IdAndReceiver_Id(requester.getId(), receiver.getId());
        assertThat(rejected).isNotNull();
        assertThat(rejected.getStatus()).isEqualTo(FriendshipStatus.REJECTED);
        assertThat(friendRepo.count()).isEqualTo(0);

        mvc.perform(get("/api/friends/requests/incoming")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void rejectRequest_notFound_returns404() throws Exception {
        User receiver = persistUser();
        UUID unknownRequester = UUID.randomUUID();

        mvc.perform(patch("/api/friends/reject")
                        .header("X-User-Id", receiver.getId().toString())
                        .param("requesterId", unknownRequester.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteFriend_existingFriendship_returns204_and_removesForBothUsers() throws Exception {
        User requester = persistUser();
        User receiver = persistUser();

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", requester.getId().toString())
                        .param("receiverId", receiver.getId().toString()))
                .andExpect(status().isCreated());

        mvc.perform(patch("/api/friends/accept")
                        .header("X-User-Id", receiver.getId().toString())
                        .param("requesterId", requester.getId().toString()))
                .andExpect(status().isOk());

        mvc.perform(delete("/api/friends/{friendId}", receiver.getId())
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isNoContent());

        assertThat(friendRepo.count()).isEqualTo(0);

        mvc.perform(get("/api/friends")
                        .header("X-User-Id", requester.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(get("/api/friends")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void deleteFriend_notFound_returns404() throws Exception {
        User user = persistUser();
        UUID unknownFriendId = UUID.randomUUID();

        mvc.perform(delete("/api/friends/{friendId}", unknownFriendId)
                        .header("X-User-Id", user.getId().toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void suggestions_rank_and_exclude_friends_and_pending_requests() throws Exception {
        User actor = persistUser();
        User mutual = persistUser();
        User strongCandidate = persistUser();
        User weakCandidate = persistUser();
        User existingFriend = persistUser();
        User pendingOutgoing = persistUser();
        User pendingIncoming = persistUser();

        friendRepo.save(new Friendship(null, actor, mutual, Instant.now()));
        friendRepo.save(new Friendship(null, strongCandidate, mutual, Instant.now()));
        friendRepo.save(new Friendship(null, actor, existingFriend, Instant.now()));

        requestRepo.save(new FriendRequest(null, actor, pendingOutgoing, FriendshipStatus.PENDING, Instant.now()));
        requestRepo.save(new FriendRequest(null, pendingIncoming, actor, FriendshipStatus.PENDING, Instant.now()));

        List<ActivityType> defaults = activityTypeRepo.findByCustomFalseOrderByNameAsc();
        ActivityType typeA = defaults.get(0);
        ActivityType typeB = defaults.size() > 1 ? defaults.get(1) : defaults.get(0);

        persistSession(actor, typeA, Instant.now().minus(1, ChronoUnit.DAYS));
        Session strongSession = persistSession(strongCandidate, typeA, Instant.now().minus(2, ChronoUnit.DAYS));
        persistSession(weakCandidate, typeB, Instant.now().minus(3, ChronoUnit.DAYS));

        SessionComment comment = new SessionComment();
        comment.setSession(strongSession);
        comment.setAuthor(actor);
        comment.setContent("Nice session");
        comment.setCreatedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        commentRepo.save(comment);

        mvc.perform(get("/api/friends/suggestions")
                        .header("X-User-Id", actor.getId().toString())
                        .param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].userId").value(strongCandidate.getId().toString()))
                .andExpect(jsonPath("$[0].score").value(12))
                .andExpect(jsonPath("$[0].mutualFriends").value(1))
                .andExpect(jsonPath("$[0].sharedActivityTypes").value(1))
                .andExpect(jsonPath("$[0].interactionCount").value(1))
                .andExpect(jsonPath("$[0].recentlyActive").value(true))
                .andExpect(jsonPath("$[1].userId").value(weakCandidate.getId().toString()))
                .andExpect(jsonPath("$[1].score").value(1))
                .andExpect(jsonPath("$[1].recentlyActive").value(true));
    }

    private User persistUser() {
        User user = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        user.setUsername("friend_user_" + suffix);
        user.setEmail("friend_user_" + suffix + "@test.com");
        user.setPassword("password_" + suffix);
        return userRepo.save(user);
    }

    private Session persistSession(User user, ActivityType activityType, Instant startedAt) {
        Session session = new Session();
        session.setUser(user);
        session.setActivityType(activityType);
        session.setStartedAt(startedAt);
        session.setVisibility(Visibility.PUBLIC);
        return sessionRepo.save(session);
    }
}
