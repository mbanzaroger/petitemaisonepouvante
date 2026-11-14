package com.petitemaisonepouvante.order.api;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Demande de commande : uniquement des identifiants de produits et des quantités, jamais de prix. */
public record PlaceOrderRequest(@NotEmpty @Size(max = 20) List<@NotNull @Valid Line> lines) {

    public record Line(@NotNull UUID productId, @Min(1) @Max(10) int quantity) {
    }
}
