/**
 * The ~200 passwords that appear at the top of every breach corpus.
 *
 * An exact match here scores 0 no matter how long the password is. A match
 * that makes up most of a password is penalised heavily. This list is small on
 * purpose: it is a sanity check, not a breach database. The real check is
 * "Check for breaches" on the vault health page, which asks Have I Been Pwned.
 */

const RAW = `
123456 password 123456789 12345678 12345 1234567 qwerty abc123 111111 123123
1234567890 1234 iloveyou 000000 dragon monkey letmein shadow master sunshine
princess qwertyuiop welcome admin login passw0rd football baseball superman
batman trustno1 hello freedom whatever qazwsx starwars 654321 jordan michael
charlie thomas daniel jessica hunter michelle computer andrew matthew access
flower soccer harley ranger buster pepper jennifer joshua maggie summer ashley
bailey pokemon mustang tigger robert ginger hockey george sexy cookie samantha
chelsea biteme matrix secret diamond amanda nicole hannah banana cheese orange
purple silver golden yellow peanut coffee london chicago dallas phoenix austin
boston vegas canada mexico brazil india japan korea china arsenal liverpool
chelseafc barcelona realmadrid juventus manutd rangers celtic cricket tennis
qwerty123 asdfgh zxcvbn asdfghjkl zxcvbnm 1qaz2wsx 1q2w3e4r 1q2w3e4r5t
q1w2e3r4 qwe123 abcd1234 abc12345 a1b2c3d4 password1 password123 passw0rd1
admin123 root toor guest user test demo default changeme letmein123
welcome123 iloveyou1 princess1 sunshine1 football1 baseball1 superman1
trustno11 monkey123 dragon123 shadow123 master123 summer2024 winter2024
spring2024 autumn2024 january february october november december
samsung google apple microsoft amazon netflix spotify twitter
facebook instagram linkedin snapchat tiktok youtube reddit
starwars1 pokemon1 minecraft fortnite roblox skyrim zelda mario sonic
987654321 11111111 00000000 121212 112233 123321 696969 666666 888888 999999
5555555 7777777 asdf1234 asdfasdf qweasdzxc poiuytrewq lkjhgfdsa mnbvcxz
whatever1 nothing anything something everything nopassword mypassword
newpassword oldpassword temppassword password12 pass1234 p@ssword p@ssw0rd
`

/** Normalised set, built once at module load. */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  RAW.split(/\s+/).filter(Boolean),
)

export function isCommonPassword(value: string): boolean {
  return COMMON_PASSWORDS.has(value.toLowerCase())
}

/**
 * The longest common password contained in `value`, or null.
 * Used to penalise "monkey!!!2024" without scoring it zero.
 */
export function longestCommonSubstring(value: string): string | null {
  const lower = value.toLowerCase()
  let longest: string | null = null
  for (const candidate of COMMON_PASSWORDS) {
    if (candidate.length < 4) continue
    if (lower.includes(candidate) && (longest === null || candidate.length > longest.length)) {
      longest = candidate
    }
  }
  return longest
}
