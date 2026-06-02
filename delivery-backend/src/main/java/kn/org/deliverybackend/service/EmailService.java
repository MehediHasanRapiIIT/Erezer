package kn.org.deliverybackend.service;

import java.util.Map;

public interface EmailService {

    /**
     * Renders the named Thymeleaf template under templates/email/ with the
     * provided variables and sends it. Execution is async — callers should not
     * block the request thread on email delivery.
     */
    void send(String toEmail, String subject, String templateName, Map<String, Object> variables);
}
