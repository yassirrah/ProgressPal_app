package org.progresspalbackend.progresspalbackend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.UUID;

@Component
public class HeaderUserIdAuthenticationFilter extends OncePerRequestFilter {

    private static final String USER_ID_HEADER = "X-User-Id";

    @Value("${app.security.allow-header-auth:true}")
    private boolean allowHeaderAuth;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!allowHeaderAuth || SecurityContextHolder.getContext().getAuthentication() != null || hasBearerToken(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String userIdHeader = request.getHeader(USER_ID_HEADER);
        if (!StringUtils.hasText(userIdHeader)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!isUuid(userIdHeader)) {
            filterChain.doFilter(request, response);
            return;
        }

        Jwt jwt = Jwt.withTokenValue("header-fallback-" + userIdHeader)
                .header("alg", "none")
                .subject(userIdHeader)
                .claim("sub", userIdHeader)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
                .build();

        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(authentication);

        filterChain.doFilter(request, response);
    }

    private boolean hasBearerToken(HttpServletRequest request) {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        return StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ");
    }

    private boolean isUuid(String value) {
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}
