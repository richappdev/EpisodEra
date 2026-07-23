package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable data class PuzzleChoice(val choiceId: String, val title: String)
@Serializable data class PuzzleHint(val revealAfterAttempt: Int, val type: String, val value: String)
@Serializable data class PuzzleAnswer(val showId: Int, val title: String, val seasonNumber: Int? = null, val episodeNumber: Int? = null)
@Serializable data class PublicPuzzle(val puzzleId: String, val puzzleDate: String, val imageUrl: String, val mobileImageUrl: String? = null, val choices: List<PuzzleChoice>, val maxAttempts: Int, val nextPuzzleAt: String, val locale: String)
@Serializable data class PuzzleAttemptState(val puzzleId: String, val selectedChoiceIds: List<String>, val attemptCount: Int, val completed: Boolean, val won: Boolean, val hints: List<PuzzleHint>, val answer: PuzzleAnswer? = null)
@Serializable data class DailyPuzzlePayload(val puzzleId: String, val puzzleDate: String, val imageUrl: String, val mobileImageUrl: String? = null, val choices: List<PuzzleChoice>, val maxAttempts: Int, val nextPuzzleAt: String, val locale: String, val attempt: PuzzleAttemptState? = null)
@Serializable data class GuessRequest(val choiceId: String)
@Serializable data class GuessResponse(val correct: Boolean, val attempt: Int, val attemptsRemaining: Int, val hint: PuzzleHint? = null, val selectedChoiceIds: List<String>, val completed: Boolean, val won: Boolean, val answer: PuzzleAnswer? = null, val showPath: String? = null)
@Serializable data class UserGameStats(val gamesPlayed: Int, val gamesWon: Int, val currentStreak: Int, val longestStreak: Int, val winsByAttempt: Map<String, Int>, val lastPlayedPuzzleDate: String? = null)
