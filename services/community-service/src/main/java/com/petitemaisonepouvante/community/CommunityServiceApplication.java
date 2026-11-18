package com.petitemaisonepouvante.community;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Espace communautaire : trocs et dons entre particuliers, salons de discussion, notifications et modération. */
@SpringBootApplication
@EnableScheduling
public class CommunityServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CommunityServiceApplication.class, args);
    }
}
