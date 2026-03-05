package org.progresspalbackend.progresspalbackend.web;

import lombok.RequiredArgsConstructor;

import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.dto.user.UserCreateDto;
import org.progresspalbackend.progresspalbackend.dto.user.UserDto;
import org.progresspalbackend.progresspalbackend.dto.user.UserProfileDto;
import org.progresspalbackend.progresspalbackend.service.UserProfileService;
import org.progresspalbackend.progresspalbackend.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService service;
    private final UserProfileService userProfileService;
    private final CurrentUser currentUser;

    @GetMapping
    public List<UserDto> list() {
        return service.list();
    }

    @GetMapping("/search")
    public List<UserDto> searchByUsername(@RequestParam("q") String query) {
        return service.searchByUsername(query);
    }

    @GetMapping("/{id}")
    public UserDto get(@PathVariable UUID id) {
        return service.find(id);
    }

    @GetMapping("/{id}/profile")
    public UserProfileDto getProfile(@PathVariable UUID id, Authentication authentication) {
        UUID actorUserId = currentUser.id(authentication);
        return userProfileService.getProfile(actorUserId, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto create(@RequestBody UserCreateDto dto) {
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public UserDto update(@PathVariable UUID id,
                          @RequestBody UserCreateDto dto) {
        return service.update(id, dto);
    }
}
