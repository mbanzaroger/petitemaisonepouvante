package com.petitemaisonepouvante.editorial.subscription;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Adresse de livraison du fanzine papier (France métropolitaine dans le POC). */
public record Address(
        @NotBlank @Size(max = 100) String recipient,
        @NotBlank @Size(max = 200) String street,
        @NotBlank @Pattern(regexp = "[0-9]{5}") String postalCode,
        @NotBlank @Size(max = 100) String city) {

    Address strip() {
        return new Address(recipient.strip(), street.strip(), postalCode.strip(), city.strip());
    }
}
