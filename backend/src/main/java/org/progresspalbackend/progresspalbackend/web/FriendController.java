package org.progresspalbackend.progresspalbackend.web;


import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendRequestDto;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendShipDto;
import org.progresspalbackend.progresspalbackend.service.FriendShipService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/friends")
public class FriendController {

    @Autowired
    private final FriendShipService friendShipService;
    private final CurrentUser currentUser;

    public FriendController(FriendShipService friendShipService, CurrentUser currentUser) {
        this.friendShipService = friendShipService;
        this.currentUser = currentUser;
    }

    @GetMapping
    List<FriendShipDto> list(Authentication authentication){
        UUID userId = currentUser.id(authentication);
        return friendShipService.getAll(userId);
    }

    @GetMapping("/requests/incoming")
    List<FriendRequestDto> incomingRequests(Authentication authentication) {
        UUID userId = currentUser.id(authentication);
        return friendShipService.getIncomingPendingRequests(userId);
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/send")
    void sendRequest(Authentication authentication,
                     @RequestParam UUID receiverId){
        UUID userId = currentUser.id(authentication);
        friendShipService.sendRequest(userId, receiverId);
    }

    @PatchMapping("/accept")
    void acceptRequest(Authentication authentication,
                       @RequestParam UUID requesterId) {
        UUID userId = currentUser.id(authentication);
        friendShipService.acceptRequest(userId, requesterId);
    }

}
