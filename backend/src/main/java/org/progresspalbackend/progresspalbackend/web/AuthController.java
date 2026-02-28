package org.progresspalbackend.progresspalbackend.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.dto.auth.AuthLoginRequestDto;
import org.progresspalbackend.progresspalbackend.dto.auth.AuthLoginResponseDto;
import org.progresspalbackend.progresspalbackend.service.AuthService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public AuthLoginResponseDto login(@Valid @RequestBody AuthLoginRequestDto request) {
        return authService.login(request);
    }
}
