package org.ZingoLabs.Zingo

import org.json.JSONObject

/** The chain hint the library's network identity lists for `chainLabel`, or the label itself for a chain it does not list. */
internal fun chainHintFor(chainLabel: String, identityJson: String): String {
    val networks = JSONObject(identityJson).getJSONArray("networks")
    return (0 until networks.length())
        .map { networks.getJSONObject(it) }
        .firstOrNull { it.getString("chain_label") == chainLabel }
        ?.getString("chain_hint")
        ?: chainLabel
}
