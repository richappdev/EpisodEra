package com.episodera.core.network

fun interface AuthTokenProvider { fun token(): String? }
fun interface AppCheckTokenProvider { fun token(): String? }
fun interface LanguageProvider { fun language(): String? }
fun interface PlayerIdProvider { fun playerId(): String? }
