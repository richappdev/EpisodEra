package com.episodera.core.design

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.material3.MaterialTheme

@Composable
fun CyanAccentTopRule(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(modifier) {
        androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().height(2.dp).background(MaterialTheme.colorScheme.primary))
        content()
    }
}
