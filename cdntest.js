const defaultCdnBases = [
    'https://cdn.jsdelivr.net/gh/BradleyLikesCoding/thingy2.0@latest/',
    'https://raw.githubusercontent.com/BradleyLikesCoding/thingy2.0/main/',
    'https://cdn.statically.io/gh/BradleyLikesCoding/thingy2.0@main/',
    'https://dev.combinatronics.io/BradleyLikesCoding/thingy2.0/main/',
    'https://rawcdn.githack.com/BradleyLikesCoding/thingy2.0/main/',
    'http://htmlpreview.github.io/?https://github.com/BradleyLikesCoding/thingy2.0/blob/main/',
];

async function getCDNS(file = "cdn-test.txt", returnResponse = false, cdnBases = defaultCdnBases, log = false) {
    const targetText = 'this file is used to test if a cdn is blocked';

    for (let i = 0; i < cdnBases.length; i++) {
        const url = cdnBases[i] + file;
        try {
            if (log) console.log(`Trying CDN: ${url}`);
            const response = await fetch(url);

            let success = false;
            if (file === "cdn-test.txt") {
                const content = await response.text();
                success = content.includes(targetText);
            } else {
                success = response.ok;
            }

            if (success) {
                // Move working CDN to top of list
                if (i > 0) {
                    const [base] = cdnBases.splice(i, 1);
                    cdnBases.unshift(base);
                }
                if (log) console.log(`Success: ${url}`);
                return returnResponse ? response : url;
            } else {
                if (log) console.log(`Failed (${file === "cdn-test.txt" ? "content mismatch" : "non-200 status"}): ${url}`);
            }
        } catch (error) {
            if (log) console.log(`Failed (error): ${url}`, error.message);
            // silently continue
        }
    }

    if (log) console.log('No working CDN found');
    return null;
}
