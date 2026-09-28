package org.ZingoLabs.Zingo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/**
 * The chain hint the nightly background sync opens a wallet with, from the
 * label settings.json stores. The identity below has the shape and values
 * `swarm_network_identity()` in rust/lib/src/lib.rs reports;
 * `__tests__/backgroundSyncChainHint.unit.test.ts` holds the two to the same
 * keys and genesis.
 */
class SwarmChainHintTest {
    private val genesis = "01c34428b9e67cdd8345e0b365aaa37dd8d2d65d3869e0e5d77d567f2c39afdd"

    private val identity = """
        {
          "chain_name": "swarm-testnet",
          "coin_ticker": "SWM",
          "networks": [
            {
              "chain_label": "swarm-testnet",
              "chain_hint": "swarm-testnet",
              "display_name": "SWARM Testnet (engineering)",
              "is_production": false
            },
            {
              "chain_label": "swarm-mainnet",
              "chain_hint": "swarm-mainnet:01c34428b9e67cdd8345e0b365aaa37dd8d2d65d3869e0e5d77d567f2c39afdd",
              "display_name": "SWARM Mainnet",
              "is_production": true
            }
          ]
        }
    """.trimIndent()

    /** Tests that a mainnet wallet opens with the hint carrying the genesis when settings.json stores the bare label. */
    @Test
    fun mainnetOpensWithTheGenesisHintWhenTheSettingsHoldTheLabel() {
        val hint = chainHintFor("swarm-mainnet", identity)
        assertNotEquals("swarm-mainnet", hint)
        assertEquals("swarm-mainnet:$genesis", hint)
    }

    /** Tests that a testnet wallet opens with its label when settings.json stores it, the label being its hint. */
    @Test
    fun testnetOpensWithItsLabelWhenTheSettingsHoldIt() {
        assertEquals("swarm-testnet", chainHintFor("swarm-testnet", identity))
    }

    /** Tests that an upstream chain keeps its label when the identity does not list it. */
    @Test
    fun upstreamChainsKeepTheirLabelWhenTheIdentityDoesNotListThem() {
        for (label in listOf("main", "test", "regtest")) {
            assertEquals(label, chainHintFor(label, identity))
        }
    }

    /** Tests that an identity with no network list fails the load when it is read, rather than passing the label on. */
    @Test(expected = org.json.JSONException::class)
    fun anIdentityWithoutNetworksFailsWhenItIsRead() {
        chainHintFor("swarm-mainnet", """{ "chain_name": "swarm-testnet" }""")
    }
}
