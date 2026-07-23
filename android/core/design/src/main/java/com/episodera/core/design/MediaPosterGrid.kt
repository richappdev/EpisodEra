package com.episodera.core.design

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.episodera.core.model.MediaSummary

@Composable
fun MediaPosterGrid(items: List<MediaSummary>, modifier: Modifier = Modifier, onClick: (MediaSummary) -> Unit = {}) {
    LazyVerticalGrid(columns = GridCells.Adaptive(120.dp), modifier = modifier, horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(items, key = { "${it.mediaType}-${it.id}" }) { media ->
            PosterCard(media.title, media.images.poster, Modifier.clickable { onClick(media) })
        }
    }
}
