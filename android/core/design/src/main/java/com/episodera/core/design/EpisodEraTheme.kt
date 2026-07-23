package com.episodera.core.design

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object EpisodEraColors {
    val Background = Color(0xFF0B0E12)
    val Surface = Color(0xFF141A22)
    val SurfaceMuted = Color(0xFF1C2430)
    val Border = Color(0xFF2A3340)
    val Text = Color(0xFFF2F5F7)
    val TextSoft = Color(0xFFC5CDD6)
    val Muted = Color(0xFF8B95A3)
    val Primary = Color(0xFF3EC9D6)
    val OnPrimary = Color(0xFF06242A)
    val Action = Color(0xFFE8913A)
    val Danger = Color(0xFFD87C7C)
}

private val EpisodEraColorScheme = darkColorScheme(
    primary = EpisodEraColors.Primary,
    onPrimary = EpisodEraColors.OnPrimary,
    secondary = EpisodEraColors.Action,
    error = EpisodEraColors.Danger,
    background = EpisodEraColors.Background,
    surface = EpisodEraColors.Surface,
    surfaceVariant = EpisodEraColors.SurfaceMuted,
    outline = EpisodEraColors.Border,
    onBackground = EpisodEraColors.Text,
    onSurface = EpisodEraColors.Text,
    onSurfaceVariant = EpisodEraColors.TextSoft,
)

@Composable
fun EpisodEraTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = EpisodEraColorScheme,
        content = content,
    )
}
