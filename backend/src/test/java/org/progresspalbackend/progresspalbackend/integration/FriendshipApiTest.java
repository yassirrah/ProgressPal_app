package org.progresspalbackend.progresspalbackend.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.FriendRequest;
import org.progresspalbackend.progresspalbackend.domain.FriendshipStatus;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRequestRepository;
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

    @BeforeEach
    void cleanDb() {
        friendRepo.deleteAll();
        requestRepo.deleteAll();
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

    private User persistUser() {
        User user = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        user.setUsername("friend_user_" + suffix);
        user.setEmail("friend_user_" + suffix + "@test.com");
        user.setPassword("password_" + suffix);
        return userRepo.save(user);
    }
}
