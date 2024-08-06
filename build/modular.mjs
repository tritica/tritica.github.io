const INCLUDES_REGEX = /\[\{(.*?)\}\]/g;
const DEV_SCRIPT_REGEX = /<script type="module" src=".*modularDev\.js"><\/script>/g

function getData (input_html) {
    const patterns = input_html.match(INCLUDES_REGEX);

    const raw_args = input_html.match(INCLUDES_REGEX);

    raw_args.forEach((str, index) => {
        raw_args[index] = str.slice(2, -2)
    });

    const filenames = []
    raw_args.forEach((str, index) => {
        filenames[index] = str.split(", ")[0]
    });

    const args = []
    raw_args.forEach((str, index) => {
        const arg_data = []

        const string_args = str.split(", ")
        string_args.splice(0, 1) // remove filename

        string_args.forEach((str, index) => {
            //splitted_args = str.split("=")
            //const key = splitted_args[0]
            //const value = splitted_args[1]
            arg_data[index] = str.split("=")
        })

        args[index] = arg_data
    })

    // unique filenames
    const unique_filenames = {}
    for (let i = 0; i < filenames.length; i++) {
        const filename = filenames[i];
        const isUnique = !unique_filenames[filename];
        if (isUnique) {
            unique_filenames[filename] = []
        }

        const filename_indexes = unique_filenames[filename]
        filename_indexes.push(i)
    }

    //console.log(unique_filenames)

    return [patterns, filenames, unique_filenames, args]
}

async function getInclude(filename, buildMods) {
    if (buildMods) {
        const [fs, promisify] = buildMods
        const readFile = promisify(fs.readFile)
        //const writeFile = promisify(fs.writeFile)

        const data = await readFile("./includes/" + filename)
        const element_data = data.toString()
        return element_data
    } else {
        const response = await fetch ("/includes/" + filename)
        if (response.ok) {
            const element_data = await response.text()
            return element_data
        } else {
            return false
        }
    }
}

function createPromiseForFilenames(input_html, unique_filenames, handlerPromise) {
    const promises = []

    for (let filename in unique_filenames) {
        const indexes = unique_filenames[filename]

        promises.push(new Promise( async (resolve) => {
            for (let i = 0; i < indexes.length; i++) {
                const filename_index = indexes[i];
                await handlerPromise(filename_index)
            }
            resolve()
        } ))
    }

    //return Promise.all(promises)
    return Promise.all(promises)
}

function processHTML(input_html, html_data, buildMods) {
    const [patterns, filenames, unique_filenames, args] = html_data // unpack data

    const replace_queue = []
    async function _process(i, processed_html) {
        const replace_pattern = patterns[i];
        const filename = filenames[i];
        const file_args = args[i];

        //const response = await fetch (includes_path + filename)

        const element_data = await getInclude(filename, buildMods)
        if (element_data) {
            //sessionStorage.setItem(filename, element_data)

            // process arguments
            replace_queue.push([replace_pattern, element_data])
            //processed_html = processed_html.replace(replace_pattern, element_data)
            if (file_args.length > 0) {
                for (let arg_i = 0; arg_i < file_args.length; arg_i++) {
                    const arg_data = file_args[arg_i];
                    const key = arg_data[0];
                    const value = arg_data[1];

                    replace_queue.push([`[{${key}}]`, value])
                    //processed_html = processed_html.replace(`[{${key}}]`, value)
                }
            }
        } else {
            replace_queue.push([replace_pattern, "Failed to load: " + filename])
        }
        //console.log(filename, i)
        //return processed_html
    }

    return createPromiseForFilenames(input_html, unique_filenames, _process).then(() => {
        var proccessed_html = input_html
        for (let i = 0; i < replace_queue.length; i++) {
            const [pattern, replacement] = replace_queue[i];
            proccessed_html = proccessed_html.replace(pattern, replacement)
        }
        return proccessed_html
    })
}

function loadIncludes(input_html) {
    const html_data = getData(input_html)
    //const [patterns, filenames, unique_filenames, args] = html_data

    processHTML(input_html, html_data).then((proccessed_html) => {
        document.body.innerHTML = proccessed_html
    })
}

function buildIncludes(config, buildMods) {
    const [fs, promisify] = buildMods

    const scanForIncludes = config.scanForIncludes
    const readFile = promisify(fs.readFile)
    const writeFile = promisify(fs.writeFile)

    //const [patterns, filenames, unique_filenames, args] = html_data

    for (let i = 0; i < scanForIncludes.length; i++) {
        const html_filepath = scanForIncludes[i];
        console.log("Build: " + html_filepath + " initializing")
        readFile(html_filepath).catch(console.error).then((data) => {
            // Transform data Buffer to string.
            const input_html = data.toString();
            const html_data = getData(input_html)

            processHTML(input_html, html_data, buildMods).then((proccessed_html) => {
                // remove script
                proccessed_html = proccessed_html.replace(DEV_SCRIPT_REGEX, "")

                console.log("Build: " + html_filepath + " success!")
                writeFile(html_filepath, proccessed_html)
            })
        })
    }
}

export default loadIncludes
export {loadIncludes, buildIncludes}