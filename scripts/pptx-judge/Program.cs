using System.Text.Json;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;

var validator = new OpenXmlValidator(FileFormatVersions.Microsoft365);
foreach (var path in args)
{
    var listed = new List<string>();
    var opened = "ok";
    try
    {
        using var doc = PresentationDocument.Open(path, false);
        foreach (var error in validator.Validate(doc))
        {
            var line = error.ErrorType + ": " + error.Description;
            var part = error.Part?.Uri?.ToString() ?? "";
            var where = error.Path?.XPath ?? "";
            if (part.Length > 0) line += " " + part;
            if (where.Length > 0) line += " @ " + where;
            listed.Add(line);
        }
    }
    catch (Exception ex)
    {
        opened = ex.GetType().Name + ": " + ex.Message;
    }

    Console.WriteLine(
        JsonSerializer.Serialize(
            new Dictionary<string, object?>
            {
                ["file"] = Path.GetFileName(path),
                ["opened"] = opened,
                ["list"] = listed,
            }
        )
    );
}
