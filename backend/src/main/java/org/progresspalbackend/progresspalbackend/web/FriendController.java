package org.progresspalbackend.progresspalbackend.web;


import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendRequestDto;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendShipDto;
import org.progresspalbackend.progresspalbackend.service.FriendShipService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/friends")
public class FriendController {

    @Autowired
    private final FriendShipService friendShipService;

    public FriendController(FriendShipService friendShipService) {
        this.friendShipService = friendShipService;
    }

    @GetMapping
    List<FriendShipDto> list(@RequestHeader("X-User-Id") UUID userId){
        return friendShipService.getAll(userId);
    }

    @GetMapping("/requests/incoming")
    List<FriendRequestDto> incomingRequests(@RequestHeader("X-User-Id") UUID userId) {
        return friendShipService.getIncomingPendingRequests(userId);
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/send")
    void sendRequest(@RequestHeader("X-User-Id") UUID userId,
                     @RequestParam UUID receiverId){
        friendShipService.sendRequest(userId, receiverId);
    }

    @PatchMapping("/accept")
    void acceptRequest(@RequestHeader("X-User-Id") UUID userId,
                       @RequestParam UUID requesterId) {
        friendShipService.acceptRequest(userId, requesterId);
    }

}
