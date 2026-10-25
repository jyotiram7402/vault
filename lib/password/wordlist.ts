/**
 * Passphrase wordlist: common, lowercase English words of 3–8 letters.
 *
 * Loaded with a dynamic import() so it never reaches the first-load bundle.
 * The list is deduplicated with a Set when the module loads, and the entropy
 * figure shown in the generator is computed from the deduplicated count, so a
 * stray repeat can never overstate how strong a passphrase is.
 */

const RAW = `
able about above acorn acre across act actor add admire adopt adult advice
afford afraid after again age agent agree ahead aim air airy aisle alarm album
alert alike alive alley allow almond almost alone along aloud alpha also alter
always amaze amber amble among amount ample amuse anchor angel anger angle
animal ankle annual answer ant antler anvil any apart apex apple apply april
apron arbor arc arch arctic area arena argue arise arm armor army aroma around
arrow art artist ash aside ask asleep aspen aspect assist assume aster atlas
atom attach attic auction audio august aunt author auto autumn avenue avoid
awake award aware away awe axis axle

baby back bacon badge bagel baker balance balcony bald ball ballet balloon
bamboo banana band bandit bang bank banner bar barge bark barley barn barrel
base basil basin basket bass bat batch bath baton bay bead beam bean bear beard
beast beat beaver become bed bee beech beef beetle before began begin behind
being belief bell belly below belt bench bend beret berry beside best bet
better beyond bicycle bid big bike bill bin bind birch bird birth biscuit bison
bit bite bitter black blade blame blank blanket blast blaze bleach blend bless
blind blink bliss block blond bloom blossom blot blouse blow blue bluff blur
blush board boast boat bobcat body boil bold bolt bond bone bonus book boost
boot booth border born borrow boss both bottle bottom bough bounce bound bow
bowl box boy brace braid brain brake branch brand brass brave bread break
breeze brick bridge brief bright brim bring brisk broad broil bronze brook
broom brother brown brush bubble bucket bud buddy budget buffalo bug build bulb
bulk bull bumble bump bunch bundle bunny burden burn burrow burst bus bush busy
butler butter button buy buzz bypass

cabin cable cactus cafe cage cake calm camel camera camp canal candle candy
cane canoe canvas canyon cap cape car carbon card care cargo carol carpet
carrot carry cart carve case cash cask cast castle cat catch cattle cause cave
cease cedar celery cell cellar cement census cent center cereal chain chair
chalk chamber champ chance change channel chant chaos chapel charm chart chase
cheap cheek cheer cheese cherry chess chest chew chick chief child chili chill
chime chin chip chirp chives choice choir choose chop chord chorus chosen
chrome chunk church cider cinema circle circus citrus city civic civil claim
clam clamp clap clash clasp class classic claw clay clean clear clerk clever
click cliff climb cling clinic clip cloak clock close closet cloth cloud clover
clown club clue clump cluster clutch coach coal coast coat cobalt cobra cocoa
code coffee coil coin cold collar colony color colt column comb combat combine
come comedy comet comfort comic command common compact compass compete concept
concert conduct cone confirm connect consent consist console contact contain
content contest context control convert convey cook cookie cool copper copy
coral cord core cork corn corner correct cost cottage cotton couch cough could
count country county couple courage course court cousin cover cow coyote cozy
crab crack cradle craft crane crash crate crave crawl crayon cream create creek
creep crest crew cricket crimson crisp critic crop cross crouch crow crowd
crown crude cruise crumb crunch crush crust crystal cube cuckoo cucumber cue
cuff culture cup curb cure curious curl curry curtain curve cushion custom cut
cute cycle cymbal cypress

daily dairy daisy dam damp dance dandy danger dare dark darn dart dash data
date dawn day dazzle deal dear debate debris decade decide deck declare decline
decor decoy deed deep deer defend define degree delay delight deliver delta
demand denim dense dental deny depart depend deposit depth derby desert design
desire desk detail detect develop device devote dew diagram dial diamond diary
dice diet differ dig digit dim dine dinner dip direct dirt disc discuss dish
disk dismiss display distant ditch dive divide dizzy dock doctor dodge doe dog
doll dollar dolphin dome domino donate done donkey door dose dot double doubt
dough dove down dozen draft drag dragon drain drama draw drawer dream dress
drift drill drink drip drive drizzle drop drove drum dry duck due duet dull
dune dungeon during dusk dust duty dwarf dwell dye dynamic

eager eagle ear early earn earth ease east easy eat echo eclipse edge edit
editor eel effect effort egg eight either elastic elbow elder elect element
elegant eleven elite elk elm else email embark emblem embrace emerald emerge
emotion employ empty enable enamel enchant encode end endless endure energy
engage engine enjoy enough enrich ensure enter entire entry envelope envy equal
equator equip era erase errand error escape essay estate eternal ethics evening
event ever every evident exact exam example exceed except excess excite excuse
exempt exhale exhibit exile exist exit expand expect expert explain explore
export expose express extend extra extreme eye

fable fabric face fact factor fade fair fairy faith falcon fall false fame
family famous fan fancy far fare farm fast fasten fat fate father fault favor
fawn fear feast feather feature fee feed feel feet fellow felt fence fern ferry
festival fetch fever few fiber fiction field fierce fifteen fifth fifty fig
fight figure file fill film filter final finch find fine finger finish fir fire
firm first fish fist fit five fix flag flake flame flank flash flask flat
flavor flax fleet flesh flex flight flint flip float flock flood floor flour
flow flower fluid flute fly foam focus fog foil fold folk follow fond food fool
foot force forest forge forget fork form formal fort fortune forum forward
fossil foster found four fox frame free freeze fresh friend fringe frog from
front frost frown frozen fruit fuel full fun fund funny fur future

gadget gain galaxy gallery gallon game gap garage garden garlic gate gather
gauge gaze gear gem gene gentle genuine gesture ghost giant gift ginger giraffe
girl give glacier glad glance gland glare glass glaze gleam glide glimpse globe
gloom glory glove glow glue goal goat gold golden golf gong good goose gorge
gospel gossip govern gown grab grace grade grain grand granite grant grape
graph grasp grass grave gravel gravy gray graze great green greet grid grief
grill grin grind grip grit grocery groom groove ground group grove grow growth
guard guess guest guide guild guitar gulf gull gum gust gym

habit hail hair half hall halt hammer hamster hand handle handy hang happy
harbor hard hare harp harvest hat hatch haul haven hawk hay hazel head heal
health heap hear heart hearth heat heaven heavy hedge heel height hello helmet
help hen herb herd here hero hidden hide high hike hill hint hip hire hive
hobby hockey hold hole holiday hollow holy home honest honey honor hood hoof
hook hope horizon horn horse hose host hotel hour house hover how hug huge
human humble humid humor hunt hurdle hurry husky hut hybrid hymn

ice icon idea ideal idle igloo ignite ignore image impact import impose improve
impulse inch include income indeed index indoor infant inform inherit initial
injury ink inland inn inner input insect inside insight inspire install instant
instead intact intend intense interest into invent invest invite iris iron
island issue item ivory ivy

jacket jade jaguar jam jar jasmine jaw jazz jelly jersey jet jewel job jog join
joint joke jolly journal journey joy judge juice july jumble jump jungle junior
juniper jury just

kale keen keep kennel kettle key keyboard kick kid kind king kiosk kiss kit
kitchen kite kitten knee kneel knife knit knob knock knot know koala

label labor lace ladder lady lagoon lake lamb lamp lance land lane lantern lap
large laser lash last latch late later laugh launch laundry lava law lawn layer
lazy lead leader leaf league lean leap learn lease leash least leather leave
lecture ledge left leg legacy legal legend lemon lend length lens lentil
leopard less lesson letter lettuce level liberty library license lid life lift
light like lilac lily limb lime limit line linen link lion lip liquid list
listen little live lively liver lizard load loaf loan lobby local locate lock
locker lodge loft log logic lonely long look loop loose lord lose loss lost lot
lotus loud lounge love lovely low loyal luck lucky luggage lumber lunar lunch
lung lure luxury lynx lyric

machine magic magnet maid mail main major make mallet mammal manage mango
manner mantle manual many map maple marble march mare margin marine mark market
marsh mask mason mast master mat match mate math matter mature maze meadow meal
mean measure meat medal media medium meet melody melon melt member memory mend
mental mentor menu mercy merge merit merry mesh message metal meter method
middle might mild mile milk mill mind mine mineral mingle mint minute mirror
miss mist mix moat mobile model modern modest modify moist mole moment monkey
month mood moon moral more morning mortar mosaic moss most motel moth mother
motion motor mound mount mouse mouth move movie much mud muffin mug mule multi
muscle museum music must mustard mutual myself mystery myth

nail name napkin narrow nation native nature navy near neat neck nectar need
needle neighbor neither nephew nerve nest net network never new news next nice
nickel niece night nimble nine noble nod noise none noodle noon normal north
nose note nothing notice novel now number nurse nut nutmeg

oak oasis oat obey object oblige observe obtain ocean octopus odd offer office
often oil old olive omelet once one onion online only onto open opera opinion
oppose option orange orbit orchard order organ origin ornate orphan other otter
ounce our outdoor outer outfit outlet outline output oval oven over owl own
oxygen oyster

pace pack packet pad paddle page pail paint pair palace pale palm pan panda
panel panic pansy pants papaya paper parade parcel parent park parrot parsley
part partner party pass passage past pasta paste pastry patch path patient
patio pattern pause pave paw pay peace peach peak peanut pear pearl pebble
pecan pedal peel peer pelican pen pencil penguin people pepper perch perfect
perform perfume perhaps period permit person pet petal phase phone photo phrase
piano pick picnic picture pie piece pier pigeon pile pilot pin pinch pine pink
pint pioneer pipe pirate pit pitch pity pivot pixel pizza place plain plan
plane planet plank plant plaster plastic plate play player plaza pleasant
please pledge plenty plot plow pluck plug plum plumber plural plus pocket poem
poet point polar pole police polish polite pond pony pool poor pop poplar poppy
popular porch port portal portion pose position possible post poster pot potato
pouch pound pour powder power praise prank prawn pray precise prefer premium
prepare present press pretty prevent price pride primary prime prince print
prior prism private prize problem proceed process produce product profile
profit program project promise promote proof proper propose protect proud prove
provide prune public pudding puddle puff pull pulse pump pumpkin punch pupil
puppy purchase pure purple purpose purse pursue push put puzzle pyramid

quaint quake quality quantum quarry quarter queen query quest queue quick quiet
quill quilt quit quite quiver quiz quota quote

rabbit race rack radar radio radish raft rag rail rain raise rake rally ramp
ranch random range rank rapid rare rate rather ratio raven raw ray reach react
read ready real realm reason rebel recall receipt receive recent recipe record
recover recruit recycle red reduce reed reef refer reflect reform refuge refuse
regard region regret regular rehearse reign reject relax release relief rely
remain remark remedy remind remote remove render renew rent repair repeat
replace reply report request require rescue research reserve resist resolve
resort resource respect respond rest result resume retail retain retire retreat
return reveal review revise reward rhyme rhythm ribbon rice rich ride ridge
right rigid rim ring rinse ripe ripple rise risk ritual river road roast robin
robot rock rocket rod rodeo role roll roof room root rope rose roster rotate
rough round route routine row royal rubber ruby rudder rug rugby ruin rule
ruler rumor run rung runner rural rush rust rustic rye

sack sacred saddle safari safe sage sail sailor saint salad salmon salon salt
salute same sample sand sandal sauce sausage save saw say scale scan scarf
scene scenic scent school science scissors scold scoop scope score scout scrap
screen screw script scroll sculpt sea seal search season seat second secret
section secure seed seek seem segment select self sell senate send senior sense
sensor sentence serial series serious serve service session settle seven severe
sew shade shadow shaft shake shall shallow shame shape share shark sharp shave
shawl shed sheep sheet shelf shell shelter shield shift shine ship shirt shock
shoe shoot shop shore short should shoulder shout shovel show shower shrimp
shrink shrub shuffle shut shy sibling side siege sigh sight sign signal silence
silent silk silly silver similar simple since sincere sing single sink sir
siren sister sit site six size skate sketch ski skill skin skip skirt skull sky
slab slate sled sleep sleeve slice slide slight slim slip slogan slope slot
slow small smart smell smile smoke smooth snack snail snake snap sneak snow
soak soap social society sock soda sofa soft soil solar sold soldier sole solid
solve some son song soon sorry sort soul sound soup source south space spare
spark speak special speech speed spell spend sphere spice spider spike spin
spine spiral spirit split spoke sponge spoon sport spot spray spread spring
sprout spruce spur square squash squeeze squid stable stack staff stage stair
stake stamp stand star stare start state statue status stay steady steak steal
steam steel steep steer stem step stereo stick stiff still sting stir stitch
stock stomach stone stool stop store storm story stove strain strand strange
strap straw stream street stress strict strike string strip stripe strong
studio study stuff stump style subject submit subtle suburb subway succeed such
sudden suffer sugar suggest suit suite sum summer summit sun sunny sunrise
sunset super supply support suppose sure surf surface surge surplus survey
survive suspect sustain swallow swam swamp swan swap swarm sway sweater sweep
sweet swell swift swim swing switch symbol system

table tablet tackle tag tail tailor take tale talent talk tall tame tank tap
tape target task taste tavern tax tea teach team tear tease tech teeth tell
temple tempo ten tenant tender tennis tense tent term terrain test text than
thank that theme theory there these they thick thief thin thing think third
thirst thirty this thorn those though thread three thrive throat throne through
throw thumb thunder ticket tide tidy tie tiger tight tile till timber time
timer tin tiny tip tire title toast today toe together toil token told toll
tomato tone tongue tonight tool tooth top topic torch total touch tough tour
toward towel tower town toy trace track trade traffic trail train trait tramp
trance travel tray treat tree trend trial tribe trick trigger trim trip triple
trophy tropic trouble truck true trumpet trunk trust truth try tube tuck tulip
tumble tuna tune tunnel turkey turn turtle tusk tutor twelve twenty twice twig
twin twist two type typical

ugly ultra umbrella unable uncle under unfold unicorn uniform union unique unit
unite unity unlock until unusual update upgrade uphold upon upper upset upward
urban urge usage use useful usher usual utility utmost

vacant vacuum valid valley value valve van vanilla vanish vapor variety various
vase vast vault veal vehicle veil vein velvet vendor venture venue verb verdict
verify verse version vertical very vessel veteran vibrant victory video view
vigor villa village vine vintage vinyl violet violin virtue visible vision
visit visual vital vivid vocal voice void volume vote vowel voyage

wade wafer wage wagon waist wait wake walk wall wallet walnut wander want warm
warn warp wash wasp waste watch water wave wax way weak wealth wear weasel
weather weave web wedge week weekend weigh weight weird welcome weld well west
wet whale wharf what wheat wheel when where which while whip whirl whisk
whisper white who whole why wide widow width wife wild will willow win wind
window wine wing wink winner winter wipe wire wisdom wise wish wit witch with
within without witness wizard wolf wonder wood wool word work world worm worry
worth would wrap wrist write wrong

yacht yard yarn yawn year yeast yellow yes yet yield yoga yogurt yolk young
your youth zebra zero zest zigzag zinc zone zoo zoom
`

/** Deduplicated at module load, so the entropy figure is always honest. */
export const WORDS: readonly string[] = Array.from(
  new Set(RAW.split(/\s+/).filter((word) => word.length >= 3 && word.length <= 8)),
)

/** log2 of the deduplicated word count — the entropy each word contributes. */
export const BITS_PER_WORD = Math.log2(WORDS.length)
