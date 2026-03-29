package org.progresspalbackend.progresspalbackend.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KeycloakUserLinkService {

    private static final String KEYCLOAK_PROVIDER = "KEYCLOAK";
    private static final int MAX_USERNAME_LENGTH = 50;

    private final UserRepository userRepository;

    @Transactional
    public UUID resolveLocalUserId(Jwt jwt) {
        String issuer = normalize(jwt.getIssuer() == null ? null : jwt.getIssuer().toString());
        String subject = normalize(jwt.getSubject());

        if (!StringUtils.hasText(issuer) || !StringUtils.hasText(subject)) {
            throw unauthorized();
        }

        return userRepository.findByAuthIssuerAndAuthSubject(issuer, subject)
                .map(User::getId)
                .orElseGet(() -> createOrLinkUser(jwt, issuer, subject).getId());
    }

    private User createOrLinkUser(Jwt jwt, String issuer, String subject) {
        if (!isVerified(jwt.getClaim("email_verified"))) {
            throw unauthorized();
        }

        String email = normalize(jwt.getClaimAsString("email"));
        if (!StringUtils.hasText(email)) {
            throw unauthorized();
        }

        return userRepository.findByEmailIgnoreCase(email)
                .map(existing -> linkExistingUser(existing, issuer, subject))
                .orElseGet(() -> createNewUser(jwt, email, issuer, subject));
    }

    private User linkExistingUser(User existing, String issuer, String subject) {
        if (StringUtils.hasText(existing.getAuthIssuer()) || StringUtils.hasText(existing.getAuthSubject())) {
            boolean sameIdentity = issuer.equals(existing.getAuthIssuer()) && subject.equals(existing.getAuthSubject());
            if (!sameIdentity) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already linked to another identity");
            }
            return existing;
        }

        existing.setAuthProvider(KEYCLOAK_PROVIDER);
        existing.setAuthIssuer(issuer);
        existing.setAuthSubject(subject);
        existing.setUpdatedAt(Instant.now());
        return userRepository.save(existing);
    }

    private User createNewUser(Jwt jwt, String email, String issuer, String subject) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(generateUniqueUsername(jwt, email));
        user.setPassword(null);
        user.setProfileImage(normalize(jwt.getClaimAsString("picture")));
        user.setCreatedAt(Instant.now());
        user.setUpdatedAt(null);
        user.setAuthProvider(KEYCLOAK_PROVIDER);
        user.setAuthIssuer(issuer);
        user.setAuthSubject(subject);
        return userRepository.save(user);
    }

    private String generateUniqueUsername(Jwt jwt, String email) {
        String base = firstNonBlank(
                normalize(jwt.getClaimAsString("preferred_username")),
                normalize(emailLocalPart(email)),
                "user"
        );

        String candidate = truncate(base, MAX_USERNAME_LENGTH);
        if (!StringUtils.hasText(candidate)) {
            candidate = "user";
        }

        if (!userRepository.existsByUsernameIgnoreCase(candidate)) {
            return candidate;
        }

        for (int suffix = 2; suffix < 10_000; suffix++) {
            String suffixValue = "-" + suffix;
            String withSuffix = truncate(candidate, MAX_USERNAME_LENGTH - suffixValue.length()) + suffixValue;
            if (!userRepository.existsByUsernameIgnoreCase(withSuffix)) {
                return withSuffix;
            }
        }

        return truncate(candidate, MAX_USERNAME_LENGTH - 9) + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String emailLocalPart(String email) {
        int atIndex = email.indexOf('@');
        if (atIndex <= 0) {
            return null;
        }
        return email.substring(0, atIndex);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isVerified(Object claim) {
        if (claim instanceof Boolean bool) {
            return bool;
        }
        if (claim instanceof String text) {
            return "true".equalsIgnoreCase(text.trim());
        }
        return false;
    }

    private ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Verified email is required for Keycloak access");
    }
}
