package org.progresspalbackend.progresspalbackend.config;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;

public class HttpStatusAuthenticationException extends AuthenticationException {

    private final HttpStatus status;

    public HttpStatusAuthenticationException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
