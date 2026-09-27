use super::{parse_address, swarm_mainnet_chain};
use zcash_keys::address::Address;
use zcash_keys::encoding::AddressCodec as _;
use zcash_keys::keys::{UnifiedAddressRequest, UnifiedSpendingKey};
use zingo_common_components::protocol::ActivationHeights;
use zingolib::config::ChainType;
use zip32::AccountId;

const LEGACY: &str = "utest18z7h64gzyjgfpuch39v2dd3g766scdzc0qdsa9qj5tawzd0n6d88dl3vyyx6elk6mcemdd6wtkd3unnvutd3sdpd3jjvgs7lz4uas7rv25d26pnryp6tczmfapqze6ggdy7645kkevh8r980zxzcyj6d9dsplukx0htsym5xsqtwaka4";

/// The FUEL payout address on SWARM Mainnet, an orchard-only unified address.
const MAINNET_UNIFIED: &str = "swm1q4q6yr3rvnnqw64tqktf7plq86cnmdxezv2g5wjerfpratclfv87guyfqru4vf775ykqd8q9e7uzscmns7w6q2fpxwl5up0ez5xqe5gv";
const MAINNET_P2PKH: &str = "s1UsiRFq4FrtHUbHobXxssCN7EVCcu9GvFk";
const MAINNET_P2PKH_GOLDEN: &str = "s1MCkDhVejM4RqDyRR1rEJkudd26FVWipPD";
const MAINNET_P2SH_GOLDEN: &str = "s3Mtm9Ez6HFNovPfrY7WpjPGZmYNxztrxbb";
const MAINNET_TEX_GOLDEN: &str = "texswm1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpfw3pr";
const TESTNET_P2PKH_GOLDEN: &str = "tm9iMLAuYMzJ6jtFLcA7rzUmfreGuKvr7Ma";
const ZCASH_P2PKH_GOLDEN: &str = "t1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs";

fn parsed(address: &str) -> serde_json::Value {
    serde_json::from_str(&parse_address(address.to_owned()).unwrap()).unwrap()
}

/// The unified and Sapling addresses the all-zero seed derives on `chain`.
fn derived(chain: &ChainType) -> (String, String) {
    let viewing = UnifiedSpendingKey::from_seed(chain, &[0u8; 32], AccountId::ZERO)
        .unwrap()
        .to_unified_full_viewing_key();
    let (unified, _) = viewing
        .default_address(UnifiedAddressRequest::AllAvailableKeys)
        .unwrap();
    let (_, sapling) = viewing.sapling().unwrap().default_address();
    (unified.encode(chain), sapling.encode(chain))
}

fn assert_mainnet(address: &str, kind: &str) {
    let answer = parsed(address);
    assert_eq!(answer["status"], "success", "{address}: {answer}");
    assert_eq!(answer["chain_name"], "swarm-mainnet", "{address}: {answer}");
    assert_eq!(answer["address_kind"], kind, "{address}: {answer}");
}

#[test]
fn tests_swarm_encoding_when_a_legacy_address_is_parsed() {
    let legacy: serde_json::Value =
        serde_json::from_str(&parse_address(LEGACY.to_owned()).unwrap()).unwrap();
    assert_eq!(legacy["status"], "success");
    assert_eq!(legacy["chain_name"], "swarm-testnet");
    let encoded = legacy["shielded_only_ua"].as_str().unwrap();
    assert!(encoded.starts_with("swarm1"));
    let canonical: serde_json::Value =
        serde_json::from_str(&parse_address(encoded.to_owned()).unwrap()).unwrap();
    assert_eq!(canonical["status"], "success");
    assert_eq!(canonical["shielded_only_ua"], encoded);
    assert_eq!(
        canonical["receivers_available"],
        serde_json::json!(["orchard"])
    );

    let mixed = encoded.replacen("swarm", "SwarM", 1);
    let rejected: serde_json::Value = serde_json::from_str(&parse_address(mixed).unwrap()).unwrap();
    assert_eq!(rejected["status"], "Invalid address");
}

/// Tests that a live SWARM Mainnet unified address parses as a swarm-mainnet unified address when
/// the app checks a recipient.
#[test]
fn tests_swarm_mainnet_when_a_production_unified_address_is_parsed() {
    assert_mainnet(MAINNET_UNIFIED, "unified");
    let answer = parsed(MAINNET_UNIFIED);
    assert_eq!(
        answer["receivers_available"],
        serde_json::json!(["orchard"])
    );
    assert_eq!(answer["shielded_only_ua"], MAINNET_UNIFIED);
}

/// Tests that `s1…` and `s3…` addresses parse as swarm-mainnet transparent addresses when the app
/// checks a recipient.
#[test]
fn tests_swarm_mainnet_when_a_production_transparent_address_is_parsed() {
    for address in [MAINNET_P2PKH, MAINNET_P2PKH_GOLDEN, MAINNET_P2SH_GOLDEN] {
        assert_mainnet(address, "transparent");
    }
}

/// Tests that every address a SWARM Mainnet wallet derives parses as swarm-mainnet when it comes
/// back as a recipient.
#[test]
fn tests_swarm_mainnet_when_a_wallet_derived_production_address_is_parsed() {
    let (unified, sapling) = derived(&swarm_mainnet_chain());
    assert!(unified.starts_with("swm1"), "{unified}");
    assert!(sapling.starts_with("zswmsapling1"), "{sapling}");

    assert_mainnet(&unified, "unified");
    let answer = parsed(&unified);
    for receiver in ["sapling", "orchard"] {
        assert!(
            answer["receivers_available"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r.as_str() == Some(receiver)),
            "{unified} carries {receiver}: {answer}"
        );
    }
    let shielded = answer["shielded_only_ua"].as_str().unwrap();
    assert!(shielded.starts_with("swm1"), "{shielded}");
    assert_mainnet(shielded, "unified");

    assert_mainnet(&sapling, "sapling");
    assert_mainnet(MAINNET_TEX_GOLDEN, "tex");
}

/// Tests that only the SWARM Mainnet chain decodes a production address when every other chain is
/// tried.
#[test]
fn tests_swarm_mainnet_is_the_only_decoder_when_a_production_address_is_parsed() {
    let other_chains = [
        ChainType::Mainnet,
        ChainType::Testnet,
        ChainType::Regtest(ActivationHeights::default()),
        ChainType::CustomTestnet,
    ];
    for address in [MAINNET_UNIFIED, MAINNET_P2PKH, MAINNET_P2SH_GOLDEN] {
        assert!(
            Address::decode(&swarm_mainnet_chain(), address).is_some(),
            "{address} decodes on swarm-mainnet"
        );
        for chain in other_chains {
            assert!(
                Address::decode(&chain, address).is_none(),
                "{address} must not decode on {chain}"
            );
        }
    }
}

/// Tests that testnet addresses keep their testnet answer and Zcash addresses stay invalid when a
/// mainnet wallet checks them.
#[test]
fn tests_other_networks_when_their_addresses_are_parsed() {
    let (testnet_unified, testnet_sapling) = derived(&ChainType::CustomTestnet);
    for address in [
        testnet_unified.as_str(),
        testnet_sapling.as_str(),
        LEGACY,
        TESTNET_P2PKH_GOLDEN,
    ] {
        assert_eq!(parsed(address)["chain_name"], "swarm-testnet", "{address}");
    }

    let (zcash_unified, zcash_sapling) = derived(&ChainType::Mainnet);
    let damaged = MAINNET_UNIFIED.replacen("5gv", "5gw", 1);
    let damaged_transparent = MAINNET_P2PKH.replacen("GvFk", "GvFj", 1);
    for address in [
        zcash_unified.as_str(),
        zcash_sapling.as_str(),
        ZCASH_P2PKH_GOLDEN,
        damaged.as_str(),
        damaged_transparent.as_str(),
    ] {
        assert_eq!(parsed(address)["status"], "Invalid address", "{address}");
    }
}
